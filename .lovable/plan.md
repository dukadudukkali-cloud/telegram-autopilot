# Auto Posting v2 — Multi-channel + Template-locked Banners

## Goals
Make Auto Posting safe: pick multiple channels, pick banner by exact template title, pick caption from DB (same template) or AI, preview before sending, and never post the wrong banner/caption to the wrong channel.

## Database (new migration)

**`auto_posting_queue`** (replaces ad-hoc job rows for "one-shot" multi-channel posts; existing `auto_posting_jobs` continues for recurring jobs):
- `id`, `user_id`
- `template_title` (text, indexed), `brand` (text, nullable)
- `image_id` (uuid → `content_library.id`), `image_url` (text, snapshot)
- `caption` (text), `caption_source` ('ai' | 'database')
- `selected_channel_ids` (uuid[]) — FKs to `telegram_configs.id`
- `scheduled_at` (timestamptz, nullable = post now)
- `status` ('pending'|'processing'|'success'|'partial'|'failed'|'cancelled')
- `processing_started_at`, `created_at`, `updated_at`
- RLS: user_id = auth.uid(); GRANTs to authenticated + service_role.

**`auto_posting_logs`** (extend existing): ensure columns `queue_id` (uuid, nullable for backward compat with job logs), `channel_name`, `telegram_chat_id`. Add nullable `queue_id` if missing; keep existing `job_id` for legacy.

**`content_library`** additions (if absent): `template_title` (text, indexed, normalized lowercase via generated column or app-side), `brand`, `category`, `is_active` (bool default true). Existing `caption` column reused. Add index on `(user_id, lower(template_title), type)`.

**`caption_templates`** uses existing table; add `template_title` (text) to enable matching to the same template as the banner. Lookup: `user_id` + `lower(template_title)` + `status='active'`.

## Server functions (`src/lib/auto-posting-queue.functions.ts`)

All `requireSupabaseAuth`-gated, scoped by `userId`:

- `listBannersByTemplate({ template_title })` → exact-match (case-insensitive) active image rows from `content_library`.
- `listTemplateTitles()` → distinct titles for dropdown.
- `getCaptionForTemplate({ template_title })` → first active row in `caption_templates` matching title.
- `generateCaptionForTemplate({ template_title, brand, category, style })` → calls `ai.server.ts` with structured prompt.
- `previewAutoPost({ template_title, image_id, caption_source, caption_override?, channel_ids, style? })` → validates everything, returns `{ banner, caption, channels: [{id,name,chat_id}] }` or throws with clear Indonesian message.
- `enqueueAutoPost(previewPayload + scheduled_at?)` → inserts a `auto_posting_queue` row with status `pending`. Returns id.
- `cancelQueueItem({ id })`, `listQueue()`, `listQueueLogs({ queue_id })`.

**Validation rules** (server-side, reused by preview + enqueue + worker):
1. `channel_ids.length > 0`, all belong to user, all have `chat_id`, `is_connected`.
2. `image_id` row exists, `user_id` matches, `is_active`, has `media_url`.
3. `lower(banner.template_title) === lower(template_title)` — else `"Banner tidak ditemukan untuk template ini"`.
4. `caption.trim().length > 0`.
5. If `caption_source='database'` → caption must come from a `caption_templates` row whose title matches; if none → `"Caption template tidak ditemukan untuk template ini"`.

## Worker (`src/lib/auto-posting-queue.server.ts`, used by existing `/api/public/hooks/run-auto-posting`)

Extend the existing tick to also process queue:
1. `SELECT ... FOR UPDATE SKIP LOCKED` semantic emulated via atomic UPDATE: `UPDATE auto_posting_queue SET status='processing', processing_started_at=now() WHERE id IN (SELECT id FROM auto_posting_queue WHERE status='pending' AND (scheduled_at IS NULL OR scheduled_at <= now()) LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *`.
2. For each row: re-run validation; for each `channel_id`, build a transient `posts` row and call `sendPostToTelegramSrv`; insert `auto_posting_logs` with `queue_id`, `channel_id`, `channel_name`, `telegram_chat_id`, status, error.
3. After all channels processed: status = `success` (all ok), `partial` (some failed), `failed` (all failed). Per-channel failure never blocks other channels.
4. Idempotency: `processing` status prevents double pick; logs unique on `(queue_id, channel_id)` to prevent duplicate sends on retry.

Cron stays at `* * * * *` (already registered).

## UI

**`src/components/AutoPostingControl.tsx`** — extend with new "Multi-Channel Post" tab:
- Dropdown: template_title (from `listTemplateTitles`).
- Banner preview (auto-loads via `listBannersByTemplate`; if multiple, allow pick).
- Caption source toggle: AI / Database.
  - AI: shows brand/category/style inputs + "Generate Caption AI" button → fills textarea.
  - Database: auto-fills textarea from `getCaptionForTemplate`; warns if empty.
- Channel list: checkbox per `telegram_configs`, "Pilih Semua" / "Hapus Pilihan" buttons.
- Schedule: "Posting Sekarang" or datetime picker.
- Buttons: Preview, Posting Sekarang, Jadwalkan, Batalkan.
- Preview modal: channels (names + count), template, image, caption, source.
- After enqueue: toast + appears in "Riwayat Posting" table below with status badge and per-channel sub-rows from logs.

Recurring auto-jobs UI (existing) stays untouched.

## Files
**Create:**
- `supabase/migrations/<ts>_auto_posting_queue.sql`
- `src/lib/auto-posting-queue.functions.ts`
- `src/lib/auto-posting-queue.server.ts`
- `src/components/AutoPostingMultiChannel.tsx`
- `src/components/AutoPostingQueueTable.tsx`

**Edit:**
- `src/components/AutoPostingControl.tsx` — add tab/section
- `src/routes/api/public/hooks/run-auto-posting.ts` — also call queue tick
- `src/lib/ai.server.ts` — add `generateCaptionForTemplate`
- `src/integrations/supabase/types.ts` — auto-regen after migration

## Out of scope
- Existing recurring `auto_posting_jobs` flow (kept as-is)
- Login, sidebar, drafts, templates, library CRUD
- Replacing existing dashboard widgets

## Test plan
1. Create banner in Library with `template_title='BETJITU88'`.
2. Create caption template with same title.
3. Open Auto Posting → pick BETJITU88 → see only that banner.
4. Select 3 channels → Preview → confirm content.
5. "Posting Sekarang" → within ~60s all 3 channels receive same banner+caption; logs show 3 success rows.
6. Disconnect 1 channel → re-run → queue status = `partial`, 2 success + 1 failed log.
7. Pick template with no banner → error "Banner tidak ditemukan untuk template ini", nothing enqueued.
8. Schedule 2 minutes ahead → not posted before time; posted after.
