import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listTemplateTitles,
  listBannersByTemplate,
  listChannels,
  getCaptionForTemplate,
  generateCaptionForTemplate,
  previewAutoPost,
  enqueueAutoPost,
  cancelQueueItem,
  listQueue,
  listQueueLogs,
} from "@/lib/auto-posting-queue.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarClock, Eye, Sparkles, Send, X, RefreshCcw } from "lucide-react";

type TemplateTitle = { title: string; brand: string | null; category: string | null };
type Banner = { id: string; title: string; brand: string | null; category: string | null; media_url: string | null; caption: string | null };
type Channel = { id: string; channel_name: string | null; channel_id: string | null; is_connected: boolean | null; is_active: boolean | null };
type QueueItem = any;

const STATUS_BADGE: Record<string, string> = {
  pending: "border-border bg-muted/40 text-muted-foreground",
  processing: "border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]",
  success: "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]",
  partial: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted/40 text-muted-foreground",
};

export function AutoPostingMultiChannel() {
  const fnTitles = useServerFn(listTemplateTitles);
  const fnBanners = useServerFn(listBannersByTemplate);
  const fnChannels = useServerFn(listChannels);
  const fnCaptionDb = useServerFn(getCaptionForTemplate);
  const fnCaptionAi = useServerFn(generateCaptionForTemplate);
  const fnPreview = useServerFn(previewAutoPost);
  const fnEnqueue = useServerFn(enqueueAutoPost);
  const fnCancel = useServerFn(cancelQueueItem);
  const fnQueue = useServerFn(listQueue);
  const fnQueueLogs = useServerFn(listQueueLogs);

  const [titles, setTitles] = useState<TemplateTitle[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [selectedBannerId, setSelectedBannerId] = useState<string>("");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [captionSource, setCaptionSource] = useState<"ai" | "database">("database");
  const [caption, setCaption] = useState<string>("");
  const [style, setStyle] = useState<string>("promosi singkat");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const selectedBanner = useMemo(
    () => banners.find((b) => b.id === selectedBannerId) ?? null,
    [banners, selectedBannerId],
  );
  const selectedTitleMeta = useMemo(
    () => titles.find((t) => t.title.toLowerCase() === selectedTitle.toLowerCase()) ?? null,
    [titles, selectedTitle],
  );

  async function refreshAll() {
    const [t, c, q] = await Promise.all([fnTitles(), fnChannels(), fnQueue()]);
    setTitles(t as TemplateTitle[]);
    setChannels(c as Channel[]);
    setQueue(q as QueueItem[]);
  }

  useEffect(() => {
    refreshAll().catch((e) => toast.error(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load banners when title changes
  useEffect(() => {
    if (!selectedTitle) {
      setBanners([]);
      setSelectedBannerId("");
      return;
    }
    (async () => {
      try {
        const rows = (await fnBanners({ data: { template_title: selectedTitle } })) as Banner[];
        setBanners(rows);
        setSelectedBannerId(rows[0]?.id ?? "");
        if (rows.length === 0) toast.warning("Banner tidak ditemukan untuk template ini");
      } catch (e: any) {
        toast.error(String(e?.message ?? e));
      }
    })();
  }, [selectedTitle, fnBanners]);

  // Auto-load caption from DB when source=database + title changes
  useEffect(() => {
    if (captionSource !== "database" || !selectedTitle) return;
    (async () => {
      try {
        const row = (await fnCaptionDb({ data: { template_title: selectedTitle } })) as {
          caption_text?: string;
        } | null;
        if (row?.caption_text) setCaption(row.caption_text);
        else {
          setCaption("");
          toast.warning("Caption template untuk template ini belum dibuat.");
        }
      } catch (e: any) {
        toast.error(String(e?.message ?? e));
      }
    })();
  }, [selectedTitle, captionSource, fnCaptionDb]);

  function toggleChannel(id: string) {
    setSelectedChannelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function selectAllChannels() {
    setSelectedChannelIds(channels.map((c) => c.id));
  }
  function clearChannels() {
    setSelectedChannelIds([]);
  }

  async function generateAiCaption() {
    if (!selectedTitle) return toast.error("Pilih template dulu");
    setBusy(true);
    try {
      const { caption: newCap } = (await fnCaptionAi({
        data: {
          template_title: selectedTitle,
          brand: selectedTitleMeta?.brand ?? selectedBanner?.brand ?? undefined,
          category: selectedTitleMeta?.category ?? selectedBanner?.category ?? undefined,
          style,
        },
      })) as { caption: string };
      setCaption(newCap);
      toast.success("Caption AI berhasil dibuat. Cek preview sebelum posting.");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function buildPayload() {
    return {
      template_title: selectedTitle,
      image_id: selectedBannerId,
      caption: caption.trim(),
      caption_source: captionSource,
      channel_ids: selectedChannelIds,
    };
  }

  async function openPreview() {
    if (!selectedTitle) return toast.error("Pilih template dulu");
    if (!selectedBannerId) return toast.error("Banner tidak ditemukan untuk template ini");
    if (!caption.trim()) return toast.error("Caption tidak boleh kosong");
    if (selectedChannelIds.length === 0) return toast.error("Pilih minimal 1 channel");
    setBusy(true);
    try {
      const r = await fnPreview({ data: buildPayload() });
      setPreviewData(r);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(later: boolean) {
    if (later && !scheduledAt) return toast.error("Pilih waktu jadwal");
    setBusy(true);
    try {
      await fnEnqueue({
        data: {
          ...buildPayload(),
          scheduled_at: later ? new Date(scheduledAt).toISOString() : null,
        },
      });
      toast.success(later ? "Posting dijadwalkan." : "Masuk antrian. Akan diposting dalam ≤60 detik.");
      setPreviewOpen(false);
      await refreshAll();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelItem(id: string) {
    try {
      await fnCancel({ data: { id } });
      toast.success("Dibatalkan");
      await refreshAll();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  }

  async function openLogs(id: string) {
    setLogsFor(id);
    try {
      const r = (await fnQueueLogs({ data: { queue_id: id } })) as any[];
      setLogs(r);
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  }

  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Multi-Channel Auto Posting</h2>
          <p className="text-xs text-muted-foreground">
            Posting banner yang sama ke beberapa channel Telegram sekaligus. Banner & caption dikunci ke template.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refreshAll()}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Judul / Template Banner</Label>
            <Select value={selectedTitle} onValueChange={setSelectedTitle}>
              <SelectTrigger><SelectValue placeholder="Pilih template…" /></SelectTrigger>
              <SelectContent>
                {titles.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground">Belum ada banner di Library.</div>
                )}
                {titles.map((t) => (
                  <SelectItem key={t.title} value={t.title}>
                    {t.title} {t.brand ? `· ${t.brand}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {banners.length > 1 && (
            <div>
              <Label>Pilih Banner</Label>
              <Select value={selectedBannerId} onValueChange={setSelectedBannerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {banners.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.title} — {b.id.slice(0, 6)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedBanner?.media_url ? (
            <div>
              <Label>Preview Banner</Label>
              <img
                src={selectedBanner.media_url}
                alt={selectedBanner.title}
                className="mt-1 max-h-64 w-full rounded-lg border border-border/60 object-contain bg-muted/20"
              />
            </div>
          ) : selectedTitle ? (
            <p className="text-sm text-destructive">Banner tidak ditemukan untuk template ini.</p>
          ) : null}

          <div>
            <Label>Sumber Caption</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={captionSource === "database" ? "default" : "outline"}
                onClick={() => setCaptionSource("database")}
              >
                Database
              </Button>
              <Button
                type="button"
                size="sm"
                variant={captionSource === "ai" ? "default" : "outline"}
                onClick={() => setCaptionSource("ai")}
              >
                AI
              </Button>
            </div>
          </div>

          {captionSource === "ai" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Gaya promosi (mis. ramah, FOMO, formal)"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              />
              <Button type="button" onClick={generateAiCaption} disabled={busy}>
                <Sparkles className="h-4 w-4" /> Generate Caption AI
              </Button>
            </div>
          )}

          <div>
            <Label>Caption</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              placeholder="Caption akan otomatis terisi dari template / AI"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <Label>Channel Tujuan ({selectedChannelIds.length}/{channels.length})</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={selectAllChannels}>
                  Pilih Semua
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={clearChannels}>
                  Hapus Pilihan
                </Button>
              </div>
            </div>
            <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
              {channels.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">Belum ada channel terhubung.</p>
              )}
              {channels.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selectedChannelIds.includes(c.id)}
                    onCheckedChange={() => toggleChannel(c.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.channel_name || c.channel_id}</div>
                    <div className="text-xs text-muted-foreground">{c.channel_id}</div>
                  </div>
                  <span
                    className={
                      c.is_connected
                        ? "text-xs text-[var(--success)]"
                        : "text-xs text-destructive"
                    }
                  >
                    {c.is_connected ? "Connected" : "Off"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Waktu Posting</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={scheduleMode === "now" ? "default" : "outline"}
                onClick={() => setScheduleMode("now")}
              >
                Sekarang
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scheduleMode === "later" ? "default" : "outline"}
                onClick={() => setScheduleMode("later")}
              >
                Jadwalkan
              </Button>
            </div>
            {scheduleMode === "later" && (
              <Input
                type="datetime-local"
                className="mt-2"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={openPreview} disabled={busy} variant="secondary">
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button
              onClick={() => submit(false)}
              disabled={busy || scheduleMode !== "now"}
              className="glow"
            >
              <Send className="h-4 w-4" /> Posting Sekarang
            </Button>
            <Button
              onClick={() => submit(true)}
              disabled={busy || scheduleMode !== "later"}
              variant="outline"
            >
              <CalendarClock className="h-4 w-4" /> Jadwalkan
            </Button>
          </div>
        </div>
      </div>

      {/* Recent queue */}
      <div className="mt-6">
        <h3 className="mb-2 font-display text-sm font-semibold">Riwayat Auto Posting</h3>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Channel</th>
                <th className="px-3 py-2 text-left">Sumber</th>
                <th className="px-3 py-2 text-left">Jadwal</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Belum ada antrian posting.
                  </td>
                </tr>
              )}
              {queue.map((q) => (
                <tr key={q.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">{q.template_title}</td>
                  <td className="px-3 py-2">{q.selected_channel_ids?.length ?? 0}</td>
                  <td className="px-3 py-2 capitalize">{q.caption_source}</td>
                  <td className="px-3 py-2 text-xs">
                    {q.scheduled_at ? new Date(q.scheduled_at).toLocaleString("id-ID") : "Langsung"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_BADGE[q.status] ?? STATUS_BADGE.pending}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openLogs(q.id)}>
                      Logs
                    </Button>
                    {q.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelItem(q.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Posting</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Template:</span>{" "}
                <strong>{previewData.template_title}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Sumber caption:</span>{" "}
                <strong className="uppercase">{previewData.caption_source}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Channel ({previewData.channels.length}):</span>{" "}
                {previewData.channels.map((c: any) => c.channel_name || c.channel_id).join(", ")}
              </div>
              {previewData.banner?.media_url && (
                <img
                  src={previewData.banner.media_url}
                  alt=""
                  className="max-h-64 w-full rounded-lg border border-border/60 object-contain bg-muted/20"
                />
              )}
              <div className="whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                {previewData.caption}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>Batalkan</Button>
            <Button onClick={() => submit(scheduleMode === "later")} disabled={busy}>
              {scheduleMode === "later" ? "Jadwalkan" : "Posting Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs dialog */}
      <Dialog open={!!logsFor} onOpenChange={(o) => !o && setLogsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Posting per Channel</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto text-sm">
            {logs.length === 0 && (
              <p className="py-6 text-center text-muted-foreground">Belum ada log.</p>
            )}
            {logs.map((l) => (
              <div key={l.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{l.channel_name || l.telegram_chat_id || l.channel_id}</span>
                  <span className={l.status === "sent" ? "text-[var(--success)]" : "text-destructive"}>
                    {l.status?.toUpperCase()}
                  </span>
                </div>
                {l.error_message && (
                  <p className="mt-1 text-xs text-destructive">{l.error_message}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("id-ID")}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
