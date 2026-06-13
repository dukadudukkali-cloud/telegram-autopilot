## Auto Posting Control — Implementation Plan

A new module added alongside existing features. No changes to login, sidebar, or existing posting flows.

### 1. Database (new migration)

New tables (all RLS-scoped to `user_id`, with GRANTs):

- **auto_posting_jobs** — id, user_id, channel_id (FK telegram_configs), channel_name, mode_posting (`manual_queue` | `auto_db` | `auto_caption_ai` | `full_ai`), image_source (`library` | `channel_content` | `ai_generate`), caption_source (`template` | `random_template` | `ai_rewrite` | `ai_generate`), total_posts, interval_seconds, button_set jsonb, status (`idle`|`running`|`paused`|`stopped`|`error`|`completed`), sent_count, failed_count, remaining_count, next_run_at, started_at, paused_at, stopped_at, completed_at, last_error, created_at, updated_at.
- **auto_posting_logs** — id, job_id (FK), user_id, post_id (nullable), channel_id, image_url, caption_text, telegram_message_id, status (`sent`|`failed`), error_message, sent_at, created_at.
- **caption_templates** — id, user_id, channel_id (nullable, FK), channel_name, template_name, caption_text, status (`active`|`inactive`), created_at, updated_at.
  - (Existing `content_templates` is keyword-driven; this is channel-scoped — kept separate per spec.)
- Add `channel_id` (nullable) + `used_count` (int default 0) to existing **content_library** if missing, to satisfy the spec's channel_id/used_count rule without breaking current usage.

### 2. Worker (server-side, persistent)

- Reuse the existing `pg_cron → /api/public/hooks/run-schedules` cron path. Add a sibling tick endpoint `/api/public/hooks/run-auto-posting` invoked every minute (or extend the existing scheduler) that:
  1. Loads all `auto_posting_jobs` with `status='running'` and `next_run_at <= now()`.
  2. For each job (service-role client, RLS-bypass safe because filtered by `user_id`):
     - Picks next image per `image_source` (least-recently-used in `content_library` for that channel/user; or generates via Lovable AI).
     - Picks/generates caption per `caption_source` (random `caption_templates` row, AI rewrite via `google/gemini-2.5-flash`, or AI generate).
     - Calls existing `sendPostToTelegramSrv` with the job's selected button set.
     - On success: increments `sent_count`, `content_library.used_count`, logs to `auto_posting_logs`, sets `next_run_at = now() + interval_seconds`.
     - On failure: increments `failed_count`, logs error; auto-stops with `status='error'` after 3 consecutive fails.
     - When `sent_count + failed_count >= total_posts`: marks `completed`.
- Worker is fully server-side → keeps running when browser closes; persistent login not required for execution (job rows own state).

### 3. Server functions (`src/lib/auto-posting.functions.ts`)

`createAutoPostingJob`, `startJob`, `pauseJob`, `resumeJob`, `stopJob`, `retryFailed`, `runTestPost` (single immediate post), `listJobs`, `getJobLogs`. All `requireSupabaseAuth` + scoped by `userId`.

Plus `caption-templates.functions.ts` CRUD.

### 4. AI integration

Uses existing `LOVABLE_API_KEY`. New `src/lib/ai.server.ts` helpers:
- `generateCaption({ channel, theme, keywords })` → Gemini 2.5 Flash.
- `rewriteCaption(text)`.
- `generateImagePrompt(channel)`.
- `generateImage(prompt)` → `google/gemini-2.5-flash-image` (nano-banana); uploads result to `content-library` bucket, inserts `content_library` row, returns URL.

### 5. Dashboard UI

New component `AutoPostingControl.tsx` added to `dashboard.tsx` below stats:
- Card with neon cyan/violet glow, matching premium dark theme.
- Form: channel select, mode, image source, caption source, total posts, interval, button set picker.
- Validation block (bot token / channel / admin / media / caption / buttons) before Start.
- Action buttons: Start, Pause, Resume, Stop, Run Test 1 Post.
- Worker status badge + progress bar + counters (target / sent / failed / remaining), polled every 5s via TanStack Query.
- "Auto Posting Terbaru" table: Channel, Mode, Total, Sent, Failed, Status, Actions (View Logs / Pause / Resume / Stop / Retry Failed).
- Logs drawer per job.

New routes:
- `/auto-posting` (full management page, same component but expanded with logs).
- `/caption-templates` (CRUD for caption templates — sidebar entry under "Telegram").

### 6. Files

**Created:**
- migration `…_auto_posting.sql`
- `src/lib/auto-posting.functions.ts`, `auto-posting.server.ts`
- `src/lib/caption-templates.functions.ts`
- `src/lib/ai.server.ts`
- `src/components/AutoPostingControl.tsx`, `AutoPostingJobsTable.tsx`, `AutoPostingLogsDrawer.tsx`
- `src/routes/api/public/hooks/run-auto-posting.ts`
- `src/routes/_authenticated/auto-posting.tsx`
- `src/routes/_authenticated/caption-templates.tsx`

**Edited:**
- `src/routes/_authenticated/dashboard.tsx` — embed control panel + recent jobs.
- `src/components/AppSidebar.tsx` — add "Auto Posting" + "Template Caption" links.
- `src/integrations/supabase/types.ts` — regenerated after migration.

### 7. Out of scope (kept stable)
- Login, existing sidebar entries, existing posts/drafts/templates/library/schedules tables and their UIs.

### Confirm before I start
1. OK to use Lovable AI Gateway (`LOVABLE_API_KEY`, no extra setup) for both captions and image generation?
2. Cron tick frequency: use the existing `pg_cron` minute job (worker honors per-job `interval_seconds` via `next_run_at`)? This means the smallest practical interval is ~60s. If you need true 30s intervals, I'll register a 30s cron — say the word.
3. Keep new `caption_templates` separate from existing `content_templates`, or merge into one table?
