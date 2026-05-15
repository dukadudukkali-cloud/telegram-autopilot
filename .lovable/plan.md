# Telegram Auto Posting System — Full Build

Membangun sistem posting Telegram lengkap di production Lovable: tombol inline dikelola permanen per akun, posting manual stabil, dan scheduler otomatis dengan delay 1 menit antar posting.

## 1. Database (migration)

**Tabel baru: `telegram_inline_buttons`**
- `id`, `telegram_account_id` (FK ke telegram_configs), `button_text`, `button_url`
- `is_active` (default true), `sort_order` (default 0)
- `created_at`, `updated_at` + trigger
- RLS: pemilik akun (via join `telegram_configs.user_id = auth.uid()`) atau admin

**Tabel `posts`**: tambah kolom `error_message text`, `sent_at timestamptz`

**Tabel `schedules`**: status mapping diperluas — `scheduled | processing | sent | failed` (kompatibel mundur dari `pending/success`).

**Hapus** `post_buttons` dari alur posting (tidak dipakai lagi; tabel dibiarkan agar tidak merusak data lama).

## 2. Halaman "Pengaturan Tombol Inline"

Route baru: `/_authenticated/telegram-buttons` (juga link dari halaman Telegram Setup).

Fitur:
- Pilih akun Telegram (dropdown)
- List tombol untuk akun terpilih (urut `sort_order`)
- Tambah / Edit (text + URL + aktif) di dialog
- Hapus dengan konfirmasi
- Switch Active/Inactive inline
- Tombol Naik/Turun untuk reorder (`sort_order`)
- Preview tombol gaya Telegram
- Validasi URL: trim + auto-prefix `https://` jika tidak diawali `http(s)://`

## 3. Hapus inline buttons dari editor posting

`PostEditor.tsx` → hapus seluruh section "Inline Buttons" + state terkait. Editor hanya mengelola judul, gambar, caption, akun Telegram, jadwal.

## 4. Posting manual (perbaikan)

`telegram.server.ts → sendPostToTelegramSrv`:
- Ambil tombol dari `telegram_inline_buttons` (bukan `post_buttons`), filter `is_active=true`, urut `sort_order`
- Validasi: bot_token, channel_id, caption/title tidak kosong
- Sukses → `posts.status='sent'`, isi `sent_at`, `telegram_message_id`, `error_message=null`
- Gagal → `posts.status='failed'`, `error_message` = pesan asli Telegram API, log ke `posting_logs`
- Tampilkan pesan asli Telegram di UI (toast)

## 5. Scheduler dengan delay 1 menit + lock + retry

`runDueSchedulesSrv` direvisi:
1. **Build queue**: ambil semua schedule `status='scheduled' AND scheduled_at<=now()`, set `status='queued'`, `available_at` berspasi 60 detik dari max(now, available_at sebelumnya).
2. **Worker per tick**: ambil **1** item `queued AND available_at<=now()`, set `processing_started_at=now()`, `status='processing'` (lock via `update ... where status='queued'` mengembalikan row → atomic).
3. Kirim → `sent` (isi `sent_at` di posts & schedules) atau `failed` (simpan error asli).
4. **Retry**: jika failed karena network/timeout/5xx Telegram → set `status='queued'`, `available_at = now+60s`, tambah counter `retry_count` (kolom baru, default 0, max 1).
5. Repeat (`daily`/`weekly`) → buat schedule baru dengan `scheduled_at` next.

**Cron production**: server route `/api/public/hooks/run-schedules` dipanggil pg_cron tiap menit, memanggil `runDueSchedulesSrv` dengan `supabaseAdmin` (bypass RLS, iterasi seluruh user).

## 6. UI Jadwal Posting

`schedules.tsx`:
- Polling tiap 10 detik
- Badge status: Scheduled / Queued / Processing / Sent / Failed (warna berbeda)
- Countdown ke `scheduled_at` atau `available_at`
- Tampilkan `error_message` saat failed

## 7. Logging

Tambah console.log terstruktur di scheduler: `[scheduler] tick`, `found N`, `processing id=...`, `tg request`, `tg response`, `success/failed`, `retry`. Semua juga tertulis ke `posting_logs`.

---

## Catatan teknis

- Semua perubahan server-side via `createServerFn` yang sudah ada (telegram.functions.ts) + cron route `/api/public/hooks/run-schedules` (auth via `apikey` anon header).
- Scheduler autopilot in-process (`scheduler-autopilot.server.ts`) **dihapus** — tidak reliable di Cloudflare Worker production. Cron pg_net adalah satu-satunya sumber kebenaran.
- RLS aman: tabel baru proteksi via `telegram_configs.user_id`.
- Reorder pakai 2 tombol panah (lebih simpel & mobile-friendly daripada DnD).
- `repeat_type` tetap dipertahankan.

## Pertanyaan sebelum eksekusi

Tidak ada — spesifikasi user sudah lengkap. Setelah Anda approve plan ini, saya:
1. Jalankan migration (Supabase)
2. Tulis semua file (server fn, route, halaman buttons, edit PostEditor, schedules UI, cron route)
3. Setup pg_cron job
4. Minta Anda Publish → Update untuk aktifkan di production
