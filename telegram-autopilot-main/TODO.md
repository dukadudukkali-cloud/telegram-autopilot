# TODO - Telegram Auto Poster (Auto Queue + Cron)

- [x] Buat migration Supabase: tambahkan kolom antrian/timing ke `schedules`
  - `sent_at`, `available_at`, `processing_started_at`, `queue_position`
- [x] Update mapping status lama saat scheduler jalan pertama kali
  - `pending` -> `scheduled`
  - `success` -> `sent`
  - `failed` -> `failed` (tetap)
- [ ] Ubah logic `runDueSchedulesSrv` menjadi:
  - Build queue: `scheduled` due -> `queued` dengan `available_at` berspasi 1 menit
  - Worker: proses **1** item saja per run (`queued` + `available_at<=now`)
  - Set status: `queued -> processing -> sent/failed`
  - Isi `sent_at` saat sukses
  - Saat gagal: simpan error asli Telegram API ke `posting_logs` dan update `schedules.status=failed`
- [ ] Pastikan timezone Asia/Jakarta dipakai untuk semua perhitungan jadwal

- [ ] Perbarui `src/routes/_authenticated/schedules.tsx`
  - tampilkan `status` realtime
  - tampilkan `scheduled_at`
  - tampilkan queue info: `queue_position` & `available_at` saat `queued/processing`
  - polling refresh otomatis (mis. 10 detik)
- [ ] Pastikan tombol "Jalankan jadwal due" tetap ada, namun hanya memicu debug (tidak bypass queue)
- [ ] Update logika penulisan `posting_logs` supaya scheduler menyimpan error asli Telegram API
- [ ] Lint/build
- [ ] Test end-to-end
  - buat beberapa schedule dengan scheduled_at sama
  - pastikan terkirim terpaut ~1 menit
  - verifikasi status & posting_logs
