import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TelegramPreview } from "@/components/TelegramPreview";
import { MediaUploader, type MediaItem } from "@/components/MediaUploader";
import { toast } from "sonner";
import { Send, CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { sendPostToTelegram } from "@/lib/telegram.functions";
import { useNavigate, Link } from "@tanstack/react-router";
import { isValidUrl } from "@/lib/content-utils";

type PreviewBtn = { button_text: string; button_url: string };

export function PostEditor({ postId, draftId }: { postId?: string; draftId?: string }) {
  const nav = useNavigate();
  const sendFn = useServerFn(sendPostToTelegram);

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [previewButtons, setPreviewButtons] = useState<PreviewBtn[]>([]);

  const [scheduleAt, setScheduleAt] = useState("");
  const [repeatType, setRepeatType] = useState("none");

  // Autosave state
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const userIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const skipAutosaveRef = useRef(true);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const channelName = selectedAccount?.channel_name || selectedAccount?.channel_id || "Channel";

  // Load accounts, post or draft
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      userIdRef.current = u.user.id;

      const { data: accs } = await supabase
        .from("telegram_configs")
        .select("id, bot_name, bot_username, channel_id, channel_name, is_active, is_connected, connection_status")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true });
      setAccounts(accs || []);

      if (postId) {
        const { data: p } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
        if (p) {
          setTitle(p.title);
          setCaption(p.caption);
          if (Array.isArray(p.media) && p.media.length > 0) setMedia(p.media as MediaItem[]);
          else if (p.image_url) setMedia([{ id: crypto.randomUUID(), type: "image", url: p.image_url }]);
          if (p.telegram_account_id) setAccountId(p.telegram_account_id);
        }
      } else if (draftId) {
        const { data: d } = await supabase
          .from("content_drafts")
          .select("*")
          .eq("id", draftId)
          .maybeSingle();
        if (d) {
          setTitle(d.title || "");
          setCaption(d.caption || "");
          if (Array.isArray(d.media)) setMedia(d.media as MediaItem[]);
          if (d.telegram_account_id) setAccountId(d.telegram_account_id);
          if (d.scheduled_at) {
            const dt = new Date(d.scheduled_at);
            const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
            setScheduleAt(local);
          }
          if (d.repeat_type) setRepeatType(d.repeat_type);
          setCurrentDraftId(d.id);
        }
      } else {
        const firstActive = (accs || []).find((a) => a.is_active);
        if (firstActive) setAccountId(firstActive.id);

        // prefill from library
        const pre = sessionStorage.getItem("library_prefill");
        if (pre) {
          try {
            const j = JSON.parse(pre);
            if (j.title) setTitle(j.title);
            if (j.caption) setCaption(j.caption);
            if (Array.isArray(j.media)) setMedia(j.media);
          } catch {}
          sessionStorage.removeItem("library_prefill");
        }

        // prefill from template
        const tpl = sessionStorage.getItem("template_apply");
        if (tpl) {
          try {
            const j = JSON.parse(tpl);
            if (j.caption) setCaption(j.caption);
            if (j.title) setTitle(j.title);
          } catch {}
          sessionStorage.removeItem("template_apply");
        }
      }

      hydratedRef.current = true;
      // unlock autosave after a tick to skip first state propagation
      setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 200);
    })();
  }, [postId, draftId]);

  // Load active inline buttons for selected account
  useEffect(() => {
    if (!accountId) {
      setPreviewButtons([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("telegram_inline_buttons")
        .select("button_text, button_url")
        .eq("telegram_account_id", accountId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setPreviewButtons((data || []) as PreviewBtn[]);
    })();
  }, [accountId]);

  // Autosave debounced (only when editing a draft / new post, not editing existing post)
  const autosavePayload = useMemo(
    () => ({ title, caption, media, accountId, scheduleAt, repeatType }),
    [title, caption, media, accountId, scheduleAt, repeatType],
  );

  useEffect(() => {
    if (postId) return; // don't autosave when editing an existing post
    if (skipAutosaveRef.current || !hydratedRef.current) return;
    if (!userIdRef.current) return;

    // Don't create empty drafts
    const hasContent =
      title.trim() || caption.trim() || media.length > 0 || accountId || scheduleAt;
    if (!hasContent) return;

    setAutosaveStatus("saving");
    const t = setTimeout(async () => {
      const payload: any = {
        user_id: userIdRef.current,
        title,
        caption,
        media: media as any,
        telegram_account_id: accountId || null,
        scheduled_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
        repeat_type: repeatType,
        source: "editor",
      };

      if (currentDraftId) {
        const { error } = await supabase
          .from("content_drafts")
          .update(payload)
          .eq("id", currentDraftId);
        if (!error) {
          setAutosaveStatus("saved");
          setLastSavedAt(new Date());
        } else {
          setAutosaveStatus("idle");
        }
      } else {
        const { data, error } = await supabase
          .from("content_drafts")
          .insert(payload)
          .select("id")
          .single();
        if (!error && data) {
          setCurrentDraftId(data.id);
          setAutosaveStatus("saved");
          setLastSavedAt(new Date());
        } else {
          setAutosaveStatus("idle");
        }
      }
    }, 1200);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosavePayload]);

  function validate(forPublish: boolean): string | null {
    if (!accountId) return "Pilih akun Telegram dulu";
    if (!caption.trim() && media.length === 0) return "Caption atau media wajib diisi";
    for (const b of previewButtons) {
      if (b.button_url && !isValidUrl(b.button_url))
        return `URL tombol "${b.button_text}" tidak valid`;
    }
    if (forPublish && scheduleAt) {
      const dt = new Date(scheduleAt);
      if (isNaN(dt.getTime())) return "Waktu jadwal tidak valid";
    }
    return null;
  }

  async function savePost(status: "draft" | "scheduled"): Promise<string | null> {
    if (!userIdRef.current) return null;
    const first = media[0];
    const payload = {
      user_id: userIdRef.current,
      title,
      caption,
      image_url: first?.type === "image" ? first.url : null,
      media: media as any,
      status,
      telegram_account_id: accountId,
    };
    let id = postId;
    if (id) {
      const { error } = await supabase.from("posts").update(payload).eq("id", id);
      if (error) {
        toast.error(error.message);
        return null;
      }
    } else {
      const { data, error } = await supabase.from("posts").insert(payload).select().single();
      if (error) {
        toast.error(error.message);
        return null;
      }
      id = data.id;
    }
    return id!;
  }

  async function clearDraftAfterPublish() {
    if (currentDraftId) {
      await supabase.from("content_drafts").delete().eq("id", currentDraftId);
    }
  }

  async function handleSendNow() {
    const err = validate(false);
    if (err) return toast.error(err);
    setBusy(true);
    const id = await savePost("draft");
    if (!id) {
      setBusy(false);
      return;
    }
    const r = await sendFn({ data: { postId: id } });
    setBusy(false);
    if (r.ok) {
      toast.success("Berhasil dikirim ke Telegram");
      await clearDraftAfterPublish();
      nav({ to: "/history" });
    } else {
      toast.error("Gagal kirim: " + (r as any).error);
    }
  }

  async function handleSchedule() {
    if (!scheduleAt) return toast.error("Pilih waktu jadwal dulu");
    const err = validate(true);
    if (err) return toast.error(err);
    setBusy(true);
    const id = await savePost("scheduled");
    if (!id) {
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("schedules").insert({
      post_id: id,
      user_id: userIdRef.current!,
      telegram_account_id: accountId,
      scheduled_at: new Date(scheduleAt).toISOString(),
      repeat_type: repeatType,
      status: "scheduled",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Dijadwalkan");
      await clearDraftAfterPublish();
      nav({ to: "/schedules" });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="flex items-center justify-end text-xs text-muted-foreground">
          {autosaveStatus === "saving" && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan draft…
            </span>
          )}
          {autosaveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Draft tersimpan otomatis
              {lastSavedAt && ` · ${lastSavedAt.toLocaleTimeString()}`}
            </span>
          )}
        </div>

        <div className="panel rounded-2xl p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="acc">Telegram Account / Channel</Label>
              {accounts.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Belum ada akun Telegram. Tambahkan dulu di menu <strong>Telegram Setup</strong>.
                </p>
              ) : (
                <select
                  id="acc"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— pilih akun —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={!a.is_active}>
                      {(a.bot_name || "Bot") + (a.bot_username ? ` (@${a.bot_username})` : "")} →{" "}
                      {a.channel_name || a.channel_id}
                      {a.is_connected ? "  🟢" : "  🔴"}
                      {!a.is_active ? "  [disabled]" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <Label htmlFor="title">Judul Postingan</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Promo Spesial Hari Ini"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Media (gambar / video)</Label>
              <div className="mt-1">
                <MediaUploader value={media} onChange={setMedia} bucket="telegram-media" max={10} />
              </div>
            </div>

            <div>
              <Label htmlFor="caption">Caption (HTML & emoji didukung)</Label>
              <Textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="✨ <b>Promo</b> spesial!&#10;#promo #hariini"
                rows={6}
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="panel rounded-2xl p-6">
          <h2 className="mb-2 font-display text-lg font-semibold">Tombol Inline</h2>
          <p className="text-sm text-muted-foreground">
            Tombol dikelola permanen per akun Telegram. Atur di{" "}
            <Link to="/telegram-buttons" className="underline">
              Pengaturan Tombol
            </Link>
            . Tombol aktif otomatis ikut di setiap posting.
          </p>
          {previewButtons.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              {previewButtons.length} tombol aktif untuk akun ini.
            </div>
          )}
        </div>

        <div className="panel rounded-2xl p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Jadwalkan</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="sched">Tanggal & Jam</Label>
              <Input
                id="sched"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="rep">Repeat</Label>
              <select
                id="rep"
                value={repeatType}
                onChange={(e) => setRepeatType(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="none">Sekali</option>
                <option value="daily">Harian</option>
                <option value="weekly">Mingguan</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSendNow} disabled={busy} className="glow">
            <Send className="mr-2 h-4 w-4" /> Posting Sekarang
          </Button>
          <Button onClick={handleSchedule} disabled={busy} variant="secondary">
            <CalendarClock className="mr-2 h-4 w-4" /> Jadwalkan
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="sticky top-20 space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            → {channelName}
            {scheduleAt && ` · ${new Date(scheduleAt).toLocaleString()}`}
          </div>
          <TelegramPreview
            channelName={channelName}
            media={media}
            caption={caption}
            buttons={previewButtons}
          />
        </div>
      </div>
    </div>
  );
}
