# Auto Posting Pro – Redesign Plan

A modern dark-mode panel that replaces the existing long form on `/auto-posting` with a guided 4-step flow, professional stats header, two primary actions (PILIH SEMUA + AUTO POST MENYELURUH), and a robust Jadwal Postingan table. Existing recurring auto-posting jobs and other menus stay untouched.

## 1. UI — `/auto-posting`

Replace `<AutoPostingMultiChannel />` rendering with a new page composed of:

**A. Stats header (5 cards):**
- Total Postingan, Terkirim, Terjadwal, Draf, Gagal — counts from `auto_posting_queue` + `auto_posting_logs` for the current user.
- Cyan/turquoise accents on dark navy background; live-updating via TanStack Query.

**B. Two primary actions row:**
- `PILIH SEMUA` → opens **Channel Picker Modal**.
- `AUTO POST MENYELURUH` → opens **Auto Post Wizard Modal** (disabled until ≥1 channel chosen).

**C. Jadwal Postingan table** (replaces current Riwayat): No, Channel, Title Konten, Mode, Sumber Gambar, Sumber Caption, Jadwal, Status badge, Aksi (Preview / Edit Jadwal / Batalkan / Posting Sekarang / Retry).

## 2. Channel Picker Modal
- Lists all rows from `telegram_configs` for user with live status badge (Connected / Error / Tidak Aktif) based on existing `last_test_status` field (or `is_active`).
- Master "Pilih Semua Channel" checkbox + per-row checkbox.
- Selection persisted in `app_settings.selected_channel_ids uuid[]` (new column) so it survives reload.
- Buttons: Simpan Pilihan / Batal.

## 3. Auto Post Wizard Modal (multi-step)

**Step 1 — Mode Posting:**
1. AI Menyeluruh (image AI + caption AI)
2. Database: Gambar + Caption (both from DB, matched)
3. Database: Gambar saja + Caption AI
4. Database: Caption saja + Gambar AI

**Step 2 — Sumber Database** (skipped for mode 1):
- Toggle: `Sesuai tanggal konten` vs `Random`.
- Matching rules implemented server-side:
  - Sesuai tanggal → match on `title + tanggal + bulan + tahun + brand`.
  - Random → match on `title + brand`.
- If no pair → log error "Gambar dan caption tidak cocok", queue row goes to `failed`.

**Step 3 — Jumlah & Jadwal:**
- Numeric input `jumlah_postingan` (min 1). Shows estimasi `N × channels = total`.
- Radio: Posting Sekarang / Jadwalkan Posting.
- If Jadwalkan: datetime picker for first slot + checkbox `Generate Jadwal Otomatis` (auto 30-min spacing per channel, starting from chosen time; channels run in parallel).

**Step 4 — Preview & Confirm:**
- Channels, mode, jumlah, jadwal, sumber gambar/caption.
- Preview of first computed post (banner + caption snippet).
- Estimasi total proses.
- Kembali / Mulai Posting.

On `Mulai Posting`: server fn `enqueueBulkAutoPost` inserts N×channels rows into `auto_posting_queue` with computed `scheduled_at`, `image_url`, `caption`, `template_title`, `brand`. Existing cron worker (`run-auto-posting`) already processes the queue.

## 4. Library Konten upgrade
Add columns to `content_library`: `tanggal smallint`, `bulan smallint`, `tahun smallint`, `brand text` (already has template_title). Add unique constraint `(user_id, lower(template_title), tanggal, bulan, tahun)`. Upgrade upload form: Title, Tgl/Bln/Thn, Brand, file, catatan, preview. Server validation rejects duplicates + missing fields.

## 5. Template Konten upgrade
Add columns to `caption_templates`: `tanggal`, `bulan`, `tahun`, `brand`, `hashtag text`, `notes text`. Same dup/validation rules.

## 6. Server functions (new file `src/lib/auto-posting-bulk.functions.ts`)
- `getAutoPostingStats` → counts for header cards.
- `saveSelectedChannels(ids[])` → persists in `app_settings`.
- `getSelectedChannels()`.
- `enqueueBulkAutoPost(input)` → validates, generates jadwal grid, inserts queue rows.
- `previewBulkAutoPost(input)` → returns first computed post + matching count.
- `listScheduledPosts`, `cancelScheduled`, `retryFailed`, `runScheduledNow`.

AI calls go through existing `ai.server.ts` (Lovable AI Gateway) — captions via `google/gemini-3-flash-preview`, images via `google/gemini-2.5-flash-image`. All server-only.

## 7. Out of scope
- Recurring `auto_posting_jobs` flow (untouched).
- Login, sidebar, telegram setup, drafts, posts editor, trash, users, activity logs.
- Existing `AutoPostingMultiChannel` component (kept as legacy fallback or removed once new flow validated — confirm preference).

## Files
- **Create:** `src/components/auto-posting/StatsHeader.tsx`, `ChannelPickerModal.tsx`, `AutoPostWizard.tsx` (Step1–4), `ScheduledTable.tsx`, `src/lib/auto-posting-bulk.functions.ts`, `src/lib/auto-posting-bulk.server.ts`, migration for `content_library`/`caption_templates`/`app_settings` columns.
- **Edit:** `src/routes/_authenticated/auto-posting.tsx`, `src/routes/_authenticated/library.tsx`, `src/routes/_authenticated/caption-templates.tsx` (or `templates.tsx`).

## Open questions
1. Keep the existing `AutoPostingMultiChannel` panel as a "Legacy" tab during transition, or remove it entirely?
2. For "AI Menyeluruh" — should the generated image be uploaded to `content-library` bucket for reuse, or sent directly to Telegram as a one-off `data:` URL?
3. "Generate Jadwal Otomatis" 30-min spacing — should channels post **simultaneously** (each channel has its own timeline starting at T) or **staggered globally** (Channel A 10:00, Channel B 10:30, …)? The brief shows the simultaneous pattern; please confirm.