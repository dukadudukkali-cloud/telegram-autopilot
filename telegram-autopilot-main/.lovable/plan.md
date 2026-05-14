# Telegram Auto Poster Bot — Build Plan

Aplikasi web siap pakai untuk auto-posting ke Telegram Channel dengan dashboard admin premium dark neon.

## 1. Backend (Lovable Cloud)

Aktifkan Lovable Cloud, lalu buat:

**Tables (semua dengan RLS):**

- `users_profile` — profil + role (admin/operator) + status
- `user_roles` (terpisah, pakai `app_role` enum + fungsi `has_role`) — best practice keamanan, mencegah privilege escalation
- `telegram_configs` — bot token + channel
- `posts` — judul, image_url, caption, status (draft/scheduled/posted/failed/deleted)
- `post_buttons` — inline buttons
- `schedules` — jadwal posting + repeat
- `posting_logs` — log eksekusi posting
- `deleted_posts_history` — trash dengan restore
- `activity_logs` — log aktivitas user
- `app_settings` — pengaturan aplikasi

**RLS:**

- Admin: full access via `has_role(uid,'admin')`
- Operator: hanya data miliknya
- Bot token disimpan di backend, frontend hanya menerima versi tersensor

**Storage:**

- Bucket `post-images` (public) untuk gambar postingan + RLS policy upload per user

**Trigger:**

- Auto-create `users_profile` + assign role saat signup (handle_new_user)
- Trigger trash: saat status posts → 'deleted', auto copy ke `deleted_posts_history`

**Server Functions (TanStack Start, bukan Edge Function Supabase):**

- `telegram-test-connection` — getMe + getChat
- `telegram-send-post` — sendPhoto + inline_keyboard, update status, log
- `telegram-delete-message` — hapus dari channel
- `admin-create-user` — buat user via service role (admin only)
- `admin-update-user` — update role/status
- `run-scheduler` — proses jadwal yang due (dipanggil cron / manual trigger tombol)

Semua call Telegram dilakukan di server. Token tidak pernah ke browser.

## 2. Frontend

**Routing (TanStack Start):**

- `/login` — Supabase Auth (email + password)
- `/_authenticated/` layout dengan sidebar + navbar
  - `/dashboard` — stats card (total posts, scheduled, channel status, dsb)
  - `/telegram-setup` — form bot, test koneksi, status
  - `/posts/new` — editor postingan + preview Telegram realtime
  - `/posts/:id/edit` — edit
  - `/schedules` — jadwal posting
  - `/history` — riwayat posting (filter status)
  - `/trash` — riwayat hapus (restore / hapus permanen)
  - `/users` — tambah pengguna (admin only)
  - `/activity-logs` — log aktivitas
  - `/settings` — pengaturan aplikasi

**Komponen utama:**

- `AppSidebar` (shadcn sidebar, collapsible icon)
- `TopNavbar` (user menu, logout)
- `TelegramPreview` (mock tampilan Telegram channel)
- `PostEditor` (judul, upload, caption emoji/hashtag, repeater inline buttons)
- `ImageUploader` (Supabase Storage)
- `ScheduleForm` (date/time + repeat)
- `UsersTable`, `HistoryTable`, `TrashTable`, `LogsTable`

## 3. Design System (dark neon futuristik)

- Background: deep navy/black `oklch(0.12 0.02 270)`
- Primary: neon cyan `oklch(0.78 0.18 200)`
- Accent: neon magenta `oklch(0.7 0.25 330)`
- Glow shadows via custom `--shadow-glow`
- Gradient borders pada card
- Font: display Space Grotesk + body Inter
- Semua warna sebagai semantic token di `src/styles.css`
- Variant button `neon`, `glow`
- Card dengan subtle border glow + backdrop blur
- Mobile responsive, sidebar collapse → icon strip

## 4. Fitur penuh, no dummy

- Upload gambar real → Supabase Storage
- Test koneksi real → Telegram getMe + getChat
- Posting real → sendPhoto dengan inline_keyboard
- Scheduler: tombol manual "Run due schedules" + instruksi setup pg_cron (URL stabil project)
- Trash: soft-delete + restore + hapus permanen (cascade)
- Activity log otomatis pada setiap aksi penting
- Token Telegram disensor di UI (`••••••••1234`)

## 5. Apa yang user perlu siapkan sendiri

- Buat bot via @BotFather → dapat bot token
- Tambahkan bot sebagai admin di channel Telegram
- Masukkan token + channel ID di menu Telegram Setup
- (Opsional) Set up pg_cron untuk scheduler otomatis — saya kasih SQL snippet di menu Settings

## Catatan teknis

- Stack: TanStack Start + React + Tailwind v4 + shadcn + Supabase (Lovable Cloud)
- Server functions pakai `createServerFn` (bukan Supabase Edge Functions, sesuai stack project)
- Role pakai `user_roles` table + security definer function (anti-recursion RLS)
- Bot token never exposed ke client; semua API Telegram via server function
- File-based routing dengan layout `_authenticated`
