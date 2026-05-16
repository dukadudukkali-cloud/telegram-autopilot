## Telegram Posting Platform — Premium Upgrade

Scope ini sangat besar (16 fitur, ~12 tabel baru, AI, analytics, bulk, roles, watermark). Saya pecah jadi **5 fase** agar bisa dikirim bertahap tanpa merusak fitur lama. Setiap fase = 1 deploy yang stabil.

### Fase 1 — Foundation (UI shell + Media Upload + Library)
1. **Design refresh**: dark premium, neon cyan/violet, glassmorphism halus, framer-motion, skeleton modern. Update `styles.css` tokens + `AppSidebar` + panel components. Tidak mengubah route lama.
2. **Advanced Media Uploader** (komponen baru `MediaUploader.tsx`):
   - drag-drop, multi-file, paste clipboard, reorder, progress, remove
   - image (png/jpg/webp ≤10MB), video (mp4/mov/webm ≤100MB, no compress)
   - thumbnail video otomatis (canvas frame extract)
   - upload ke bucket `telegram-media/{images|videos}/`
3. **Posts schema**: tambah `media` jsonb (array {type,url,thumb,size,order}) di `posts`. Editor pakai field baru, tetap backward-compat dengan `image_url`.
4. **Content Library**:
   - tabel `content_library` (user_id, type, url, thumb, title, caption, tags[], category, brand, is_favorite, used_count, last_used_at)
   - tabel `content_categories` opsional → pakai text saja dulu
   - bucket `content-library`
   - route `/library`: grid+list view, search, filter type/brand, favorite, duplicate, delete, "Gunakan untuk posting" (navigate ke editor + prefill via query/state)

### Fase 2 — Templates + Realtime Preview Upgrade + Draft System
5. **Templates**: tabel `post_templates` (name, type enum promo/event/video/news/affiliate/custom, caption, buttons jsonb, hashtags, media_layout). Route `/templates` CRUD + "save current as template" di editor.
6. **TelegramPreview upgrade**: support multi-media carousel, video player, mobile/desktop toggle, HTML caption, inline buttons sama persis dgn render Telegram.
7. **Draft autosave**: posts.status sudah ada (`draft|scheduled|posted|failed`). Tambah autosave debounce 2s di editor + duplicate draft di History.

### Fase 3 — Advanced Scheduler + Bulk Posting + Notifications
8. **Scheduler upgrade**: 
   - schedules sudah punya retry_count/available_at/status — tambah `pause` status, `random_delay_max_sec`, `timezone`
   - UI: pause/resume/cancel button, queue view, retry failed manual
   - cron sudah aktif tiap menit
9. **Bulk posting**: di editor tambah multi-select channel, caption/button override per channel. Backend loop kirim sequential dgn jeda 60s.
10. **Notifications**: toast realtime via Supabase Realtime channel `posting_logs` insert.

### Fase 4 — AI Tools + Watermark
11. **AI Caption Generator** (server fn pakai Lovable AI Gateway, model `google/gemini-2.5-flash`):
    - generate / rewrite / short / long / formal / santai / FYP / hashtag / translate
    - UI panel di editor: prompt textarea + style chips → insert ke caption
12. **AI Prompt Generator**: panel terpisah `/ai-prompts` → image prompt + video prompt (Pixverse style), preset chips.
13. **Watermark / Branding** (client-side canvas):
    - upload logo per user (app_settings.logo_url)
    - toggle "auto watermark" + posisi + opacity + preset resize 1080x1080/1280x720/1920x1080
    - apply saat upload (client canvas, kirim hasil ke storage)

### Fase 5 — Analytics + Roles + Polish
14. **Analytics** route `/analytics`: 
    - aggregate dari `posts` + `posting_logs` + `telegram_configs`
    - recharts: line (per hari), bar (per channel), pie (media type), top posts table
    - note: Telegram Bot API tidak expose view/reaction tanpa channel admin API → tampilkan "posts sent", "success rate", "failed", "active channel"; reaksi/views ditandai "coming soon" kecuali user mau saya integrasi getChat/getMessageReactions (butuh permission)
15. **Roles**: sudah ada `user_roles` (admin/operator). Tambah enum `editor`, `viewer`, `owner`. RLS policy update + UI assign role di `/users`.
16. **Activity & Audit log**: `activity_logs` sudah ada → tambah IP capture via header `x-forwarded-for` di server fn, page `/activity-logs` enrichment.
17. **Performance**: lazy route imports, image lazy loading, pagination history/library (20/page), skeleton states.
18. **Future-ready abstraction**: rename tabel `telegram_configs` tetap, tapi tambah kolom `platform` (default 'telegram') ke `posts`, `schedules`, `content_library` agar nanti tinggal extend ke WhatsApp/IG/dst tanpa migrasi besar.

### Catatan teknis penting
- Semua server logic = `createServerFn` (sudah pattern proyek). Tidak pakai Edge Function.
- Watermark dilakukan **client-side** (canvas) supaya tidak butuh `sharp` di Worker (incompat).
- Video tidak dikompres (sesuai requirement). Thumbnail diambil dari frame 0 via `<video>` + canvas.
- Telegram `sendMediaGroup` dipakai untuk multi-media (max 10 per group, mixed photo/video OK).
- AI pakai `LOVABLE_API_KEY` yang sudah tersedia — tanpa API key tambahan.
- Semua bucket baru dibuat public read + RLS write per-user.

### Pertanyaan sebelum mulai
1. **Mulai dari fase mana?** Saya rekomendasikan Fase 1 dulu (foundation) — paling impactful, tidak merusak apapun, ~1 deploy.
2. **Analytics views/reactions**: oke kalau saya tampilkan "posts sent / success rate / failed / per channel" dulu, dan views/reactions ditandai *coming soon*? (data sebenarnya butuh integrasi Bot API getChat tambahan)
3. **Watermark logo**: 1 logo per user, atau 1 logo per channel?

Approve plan ini (atau jawab pertanyaannya) dan saya langsung eksekusi Fase 1.
