import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  enqueueBulkAutoPost,
  getSelectedChannels,
  listAllChannels,
  previewBulkAutoPost,
} from "@/lib/auto-posting-bulk.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Database,
  Image as ImageIcon,
  Type,
  ArrowLeft,
  ArrowRight,
  Rocket,
} from "lucide-react";

type Mode = "ai_full" | "db_image_db_caption" | "db_image_ai_caption" | "ai_image_db_caption";
type Strategy = "by_date" | "random";
type SchedMode = "now" | "scheduled";

const MODES: { id: Mode; title: string; desc: string; icon: any }[] = [
  { id: "ai_full", title: "AI Menyeluruh", desc: "Gambar + caption dibuat AI", icon: Sparkles },
  { id: "db_image_db_caption", title: "Database: Gambar + Caption", desc: "Keduanya dari library, dicocokkan", icon: Database },
  { id: "db_image_ai_caption", title: "Database Gambar + Caption AI", desc: "Gambar dari library, caption AI", icon: ImageIcon },
  { id: "ai_image_db_caption", title: "Caption DB + Gambar AI", desc: "Caption dari template, gambar AI", icon: Type },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function localIsoNow(offsetMin = 5) {
  const d = new Date(Date.now() + offsetMin * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AutoPostWizard({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>("db_image_db_caption");
  const [strategy, setStrategy] = useState<Strategy>("random");
  const [count, setCount] = useState(1);
  const [schedMode, setSchedMode] = useState<SchedMode>("now");
  const [startAt, setStartAt] = useState(localIsoNow(5));
  const [autoGen, setAutoGen] = useState(true);
  const [spacing, setSpacing] = useState(30);

  const getSelFn = useServerFn(getSelectedChannels);
  const listChFn = useServerFn(listAllChannels);
  const previewFn = useServerFn(previewBulkAutoPost);
  const enqueueFn = useServerFn(enqueueBulkAutoPost);

  const { data: selectedIds = [] } = useQuery({
    queryKey: ["selected-channels"],
    queryFn: () => getSelFn(),
    enabled: open,
  });
  const { data: allChannels = [] } = useQuery({
    queryKey: ["all-channels"],
    queryFn: () => listChFn(),
    enabled: open,
  });

  const channelCount = (selectedIds as string[]).length;
  const totalPosts = channelCount * count;

  const usesDb = mode !== "ai_full";
  const channelNames = useMemo(
    () =>
      (allChannels as any[])
        .filter((c) => (selectedIds as string[]).includes(c.id))
        .map((c) => c.channel_name ?? c.id),
    [allChannels, selectedIds],
  );

  const previewQ = useQuery({
    queryKey: ["bulk-preview", mode, strategy, selectedIds, count],
    queryFn: () =>
      previewFn({
        data: {
          mode,
          db_strategy: strategy,
          channel_ids: selectedIds as string[],
          count_per_channel: count,
          schedule_mode: schedMode,
          start_at: schedMode === "scheduled" ? new Date(startAt).toISOString() : null,
          auto_generate: autoGen,
          spacing_min: spacing,
        },
      }),
    enabled: open && step === 4 && channelCount > 0,
    retry: false,
  });

  const enqueue = useMutation({
    mutationFn: () =>
      enqueueFn({
        data: {
          mode,
          db_strategy: strategy,
          channel_ids: selectedIds as string[],
          count_per_channel: count,
          schedule_mode: schedMode,
          start_at: schedMode === "scheduled" ? new Date(startAt).toISOString() : null,
          auto_generate: autoGen,
          spacing_min: spacing,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`${r?.enqueued ?? 0} postingan masuk ke Jadwal Postingan`);
      qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
      qc.invalidateQueries({ queryKey: ["auto-posting-stats"] });
      onOpenChange(false);
      setStep(1);
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal mengantrekan"),
  });

  function next() {
    if (step === 1 && !usesDb) setStep(3); // skip db-strategy step
    else setStep(step + 1);
  }
  function back() {
    if (step === 3 && !usesDb) setStep(1);
    else setStep(step - 1);
  }

  const canNext1 = !!mode && channelCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-cyan-400" />
            Auto Post Menyeluruh
            <span className="ml-auto text-xs font-normal text-muted-foreground">Step {step} / 4</span>
          </DialogTitle>
        </DialogHeader>

        {channelCount === 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            Belum ada channel terpilih. Klik <strong>PILIH SEMUA</strong> dulu.
          </div>
        )}

        {/* Step 1: Mode */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-cyan-400 bg-cyan-400/10 ring-1 ring-cyan-400"
                      : "border-border/40 hover:border-border"
                  }`}
                >
                  <Icon className={`mb-2 h-5 w-5 ${active ? "text-cyan-300" : "text-muted-foreground"}`} />
                  <p className="font-semibold">{m.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: DB Strategy */}
        {step === 2 && usesDb && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Cara mencocokkan gambar dan caption dari database:</p>
            <RadioGroup value={strategy} onValueChange={(v: any) => setStrategy(v)}>
              <label className="flex items-start gap-3 rounded-lg border border-border/40 p-3 hover:border-border">
                <RadioGroupItem value="by_date" id="s1" className="mt-1" />
                <div>
                  <Label htmlFor="s1" className="font-semibold">Posting sesuai tanggal konten</Label>
                  <p className="text-xs text-muted-foreground">
                    Cocokkan title + brand + tanggal/bulan/tahun. Jika tidak ada, postingan ditandai gagal.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border/40 p-3 hover:border-border">
                <RadioGroupItem value="random" id="s2" className="mt-1" />
                <div>
                  <Label htmlFor="s2" className="font-semibold">Posting secara random</Label>
                  <p className="text-xs text-muted-foreground">
                    Cocokkan title + brand saja, tanpa cek tanggal.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {/* Step 3: Jumlah + Jadwal */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Jumlah postingan per channel</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value || 1)))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Estimasi: {count} × {channelCount} channel ={" "}
                <span className="font-semibold text-cyan-300">{totalPosts} total proses</span>
              </p>
            </div>

            <RadioGroup value={schedMode} onValueChange={(v: any) => setSchedMode(v)}>
              <label className="flex items-start gap-3 rounded-lg border border-border/40 p-3">
                <RadioGroupItem value="now" id="sn" className="mt-1" />
                <div>
                  <Label htmlFor="sn" className="font-semibold">Posting Sekarang</Label>
                  <p className="text-xs text-muted-foreground">Diproses dalam ≤ 1 menit.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border/40 p-3">
                <RadioGroupItem value="scheduled" id="ss" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="ss" className="font-semibold">Jadwalkan Posting</Label>
                  {schedMode === "scheduled" && (
                    <div className="mt-2 space-y-2">
                      <Input
                        type="datetime-local"
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={autoGen}
                          onCheckedChange={(v) => setAutoGen(Boolean(v))}
                        />
                        Generate Jadwal Otomatis (setiap{" "}
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          value={spacing}
                          onChange={(e) => setSpacing(Math.max(1, Number(e.target.value || 30)))}
                          className="inline-block w-16 h-7"
                        />{" "}
                        menit)
                      </label>
                    </div>
                  )}
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Mode" value={MODES.find((m) => m.id === mode)?.title ?? mode} />
              <Info label="Sumber DB" value={usesDb ? (strategy === "by_date" ? "Sesuai tanggal" : "Random") : "—"} />
              <Info label="Channel" value={`${channelCount} channel`} />
              <Info label="Jumlah" value={`${count} × ${channelCount} = ${totalPosts}`} />
              <Info label="Jadwal" value={schedMode === "now" ? "Sekarang" : new Date(startAt).toLocaleString("id-ID")} />
              <Info label="Jarak" value={autoGen ? `${spacing} menit` : "Bersamaan"} />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Channel Tujuan</p>
              <div className="flex flex-wrap gap-1">
                {channelNames.map((n) => (
                  <Badge key={n} variant="outline">{n}</Badge>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-card/50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Preview Konten Pertama</p>
              {previewQ.isLoading && <p className="text-sm text-muted-foreground">Memuat…</p>}
              {previewQ.error && (
                <p className="text-sm text-rose-300">{(previewQ.error as any)?.message ?? "Gagal preview"}</p>
              )}
              {previewQ.data?.sample ? (
                <div className="flex gap-3">
                  {previewQ.data.sample.image_url && (
                    <img
                      src={previewQ.data.sample.image_url}
                      alt=""
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{previewQ.data.sample.template_title}</p>
                    <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">
                      {previewQ.data.sample.caption}
                    </p>
                  </div>
                </div>
              ) : (
                !previewQ.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Sampel akan dibuat saat posting.
                  </p>
                )
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
              </Button>
            )}
          </div>
          <div>
            {step < 4 && (
              <Button onClick={next} disabled={step === 1 && !canNext1}>
                Lanjut <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === 4 && (
              <Button
                onClick={() => enqueue.mutate()}
                disabled={enqueue.isPending || channelCount === 0}
                className="bg-cyan-500 hover:bg-cyan-400"
              >
                {enqueue.isPending ? "Memproses…" : "Mulai Posting"}
                <Rocket className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/30 bg-background/40 p-2">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
