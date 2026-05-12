import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TelegramPreview } from "@/components/TelegramPreview";
import { toast } from "sonner";
import { ImagePlus, Plus, Send, Trash2, CalendarClock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { sendPostToTelegram } from "@/lib/telegram.functions";
import { useNavigate } from "@tanstack/react-router";

export type ButtonRow = { id?: string; button_text: string; button_url: string; sort_order: number };

export function PostEditor({ postId }: { postId?: string }) {
  const nav = useNavigate();
  const sendFn = useServerFn(sendPostToTelegram);

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [buttons, setButtons] = useState<ButtonRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<string>("");

  // schedule
  const [scheduleAt, setScheduleAt] = useState("");
  const [repeatType, setRepeatType] = useState("none");

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const channelName = selectedAccount?.channel_name || selectedAccount?.channel_id || "Channel";

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
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
          setImageUrl(p.image_url);
          if (p.telegram_account_id) setAccountId(p.telegram_account_id);
        }
        const { data: b } = await supabase
          .from("post_buttons")
          .select("*")
          .eq("post_id", postId)
          .order("sort_order");
        setButtons(
          (b || []).map((x) => ({
            id: x.id,
            button_text: x.button_text,
            button_url: x.button_url,
            sort_order: x.sort_order,
          })),
        );
      } else {
        const firstActive = (accs || []).find((a) => a.is_active);
        if (firstActive) setAccountId(firstActive.id);
      }
    })();
  }, [postId]);

  async function handleUpload(file: File) {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("post-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setBusy(false);
  }

  async function savePost(status: "draft" | "scheduled"): Promise<string | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const payload = {
      user_id: u.user.id,
      title,
      caption,
      image_url: imageUrl,
      status,
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
    // Replace buttons
    await supabase.from("post_buttons").delete().eq("post_id", id!);
    if (buttons.length) {
      const rows = buttons
        .filter((b) => b.button_text && b.button_url)
        .map((b, i) => ({
          post_id: id!,
          button_text: b.button_text,
          button_url: b.button_url,
          sort_order: i,
        }));
      if (rows.length) await supabase.from("post_buttons").insert(rows);
    }
    return id!;
  }

  async function handleSaveDraft() {
    setBusy(true);
    const id = await savePost("draft");
    setBusy(false);
    if (id) {
      toast.success("Tersimpan sebagai draft");
      if (!postId) nav({ to: "/history" });
    }
  }

  async function handleSendNow() {
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
      nav({ to: "/history" });
    } else {
      toast.error("Gagal kirim: " + (r as any).error);
    }
  }

  async function handleSchedule() {
    if (!scheduleAt) return toast.error("Pilih waktu jadwal dulu");
    setBusy(true);
    const id = await savePost("scheduled");
    if (!id) {
      setBusy(false);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("schedules").insert({
      post_id: id,
      user_id: u.user!.id,
      scheduled_at: new Date(scheduleAt).toISOString(),
      repeat_type: repeatType,
      status: "pending",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Dijadwalkan");
      nav({ to: "/schedules" });
    }
  }

  function updateBtn(i: number, k: "button_text" | "button_url", v: string) {
    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)));
  }
  function addBtn() {
    setButtons((p) => [...p, { button_text: "", button_url: "", sort_order: p.length }]);
  }
  function rmBtn(i: number) {
    setButtons((p) => p.filter((_, idx) => idx !== i));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="panel rounded-2xl p-6">
          <div className="space-y-4">
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
              <Label>Gambar</Label>
              <div className="mt-1 flex items-center gap-3">
                <label
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                </label>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageUrl(null)}
                    className="text-destructive"
                  >
                    Hapus gambar
                  </Button>
                )}
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Inline Buttons</h2>
            <Button type="button" size="sm" variant="secondary" onClick={addBtn}>
              <Plus className="mr-1 h-4 w-4" /> Tambah Tombol
            </Button>
          </div>
          {buttons.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada tombol. Opsional.</p>
          )}
          <div className="space-y-2">
            {buttons.map((b, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs">Teks</Label>
                  <Input
                    value={b.button_text}
                    onChange={(e) => updateBtn(i, "button_text", e.target.value)}
                    placeholder="Beli Sekarang"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={b.button_url}
                    onChange={(e) => updateBtn(i, "button_url", e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => rmBtn(i)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
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
          <Button onClick={handleSaveDraft} disabled={busy} variant="ghost">
            Simpan Draft
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="sticky top-20">
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Live Preview
          </h3>
          <TelegramPreview
            channelName={channelName}
            imageUrl={imageUrl}
            caption={caption}
            buttons={buttons}
          />
        </div>
      </div>
    </div>
  );
}
