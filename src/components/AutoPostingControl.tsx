import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  createAutoJob,
  startAutoJob,
  pauseAutoJob,
  resumeAutoJob,
  stopAutoJob,
  retryFailedAutoJob,
  runTestPost,
  listAutoJobs,
} from "@/lib/auto-posting.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Bot, Pause, Play, Square, Sparkles, FlaskConical, RefreshCcw, Eye } from "lucide-react";

type Channel = { id: string; channel_name: string | null; channel_id: string | null; is_connected: boolean | null };
type Job = any;

const STATUS_COLOR: Record<string, string> = {
  idle: "text-muted-foreground",
  running: "text-[var(--neon-cyan)]",
  paused: "text-yellow-400",
  stopped: "text-muted-foreground",
  error: "text-destructive",
  completed: "text-[var(--success)]",
};

export function AutoPostingControl() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState({
    channel_id: "",
    mode_posting: "auto_db" as const,
    image_source: "library" as "library" | "channel_content" | "ai_generate",
    caption_source: "template" as "template" | "random_template" | "ai_rewrite" | "ai_generate",
    total_posts: 5,
    interval_seconds: 60,
    ai_theme: "",
    ai_keywords: "",
  });
  const [creating, setCreating] = useState(false);

  const listFn = useServerFn(listAutoJobs);
  const createFn = useServerFn(createAutoJob);
  const startFn = useServerFn(startAutoJob);
  const pauseFn = useServerFn(pauseAutoJob);
  const resumeFn = useServerFn(resumeAutoJob);
  const stopFn = useServerFn(stopAutoJob);
  const retryFn = useServerFn(retryFailedAutoJob);
  const testFn = useServerFn(runTestPost);

  async function refresh() {
    try {
      const j = await listFn();
      setJobs(j as any);
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("telegram_configs")
        .select("id, channel_name, channel_id, is_connected")
        .order("created_at", { ascending: false });
      setChannels((data as any) ?? []);
      if (data && data.length && !form.channel_id) {
        setForm((f) => ({ ...f, channel_id: data[0].id }));
      }
      await refresh();
    })();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === form.channel_id),
    [channels, form.channel_id],
  );

  async function onCreate() {
    if (!form.channel_id) return toast.error("Pilih channel dulu");
    setCreating(true);
    try {
      await createFn({ data: form as any });
      toast.success("Job dibuat");
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setCreating(false);
    }
  }

  async function action(fn: (a: any) => Promise<any>, id: string, label: string) {
    try {
      await fn({ data: { id } });
      toast.success(label);
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  }

  return (
    <div className="panel rounded-2xl p-5 border border-[var(--neon-violet)]/30 shadow-[0_0_24px_-12px_var(--neon-violet)]">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-[var(--neon-violet)]" />
        <h2 className="font-display text-lg font-semibold text-gradient-neon">
          Auto Posting Control
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Atur worker auto posting berbasis channel. Berjalan di server walau browser ditutup.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Channel</Label>
          <Select
            value={form.channel_id}
            onValueChange={(v) => setForm((f) => ({ ...f, channel_id: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih channel" />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.channel_name || c.channel_id} {c.is_connected ? "✅" : "⚠️"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Mode Posting</Label>
          <Select
            value={form.mode_posting}
            onValueChange={(v: any) => setForm((f) => ({ ...f, mode_posting: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_queue">Manual Queue</SelectItem>
              <SelectItem value="auto_db">Auto Posting Database</SelectItem>
              <SelectItem value="auto_caption_ai">Auto Caption AI</SelectItem>
              <SelectItem value="full_ai">Full AI Generate Image + Caption</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sumber Gambar</Label>
          <Select
            value={form.image_source}
            onValueChange={(v: any) => setForm((f) => ({ ...f, image_source: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="library">From Library Database</SelectItem>
              <SelectItem value="channel_content">From Channel Content Database</SelectItem>
              <SelectItem value="ai_generate">AI Generate Image</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sumber Caption</Label>
          <Select
            value={form.caption_source}
            onValueChange={(v: any) => setForm((f) => ({ ...f, caption_source: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="template">Template Caption Database</SelectItem>
              <SelectItem value="random_template">Random Template Caption</SelectItem>
              <SelectItem value="ai_rewrite">AI Rewrite Caption</SelectItem>
              <SelectItem value="ai_generate">AI Generate Full Caption</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Jumlah Postingan</Label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={form.total_posts}
            onChange={(e) => setForm((f) => ({ ...f, total_posts: Number(e.target.value) || 1 }))}
          />
        </div>
        <div>
          <Label>Interval (detik)</Label>
          <Input
            type="number"
            min={15}
            value={form.interval_seconds}
            onChange={(e) => setForm((f) => ({ ...f, interval_seconds: Number(e.target.value) || 60 }))}
          />
        </div>
        {(form.caption_source === "ai_generate" ||
          form.caption_source === "ai_rewrite" ||
          form.image_source === "ai_generate") && (
          <>
            <div>
              <Label>AI Theme</Label>
              <Input
                placeholder="contoh: lifestyle, kuliner"
                value={form.ai_theme}
                onChange={(e) => setForm((f) => ({ ...f, ai_theme: e.target.value }))}
              />
            </div>
            <div>
              <Label>AI Keywords</Label>
              <Input
                placeholder="contoh: trending, viral, fyp"
                value={form.ai_keywords}
                onChange={(e) => setForm((f) => ({ ...f, ai_keywords: e.target.value }))}
              />
            </div>
          </>
        )}
      </div>

      {activeChannel && !activeChannel.is_connected && (
        <p className="mt-3 text-xs text-yellow-400">
          ⚠️ Channel ini belum terverifikasi. Tes koneksi dulu di Telegram Setup.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onCreate} disabled={creating} className="glow">
          <Sparkles className="h-4 w-4" /> Buat Job
        </Button>
      </div>

      {/* Recent jobs */}
      <div className="mt-6">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Auto Posting Terbaru
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Mode</th>
                <th className="px-2 py-2">Progress</th>
                <th className="px-2 py-2">Sent</th>
                <th className="px-2 py-2">Failed</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Belum ada job.</td></tr>
              )}
              {jobs.map((j) => {
                const pct = Math.min(100, Math.round(((j.sent_count + j.failed_count) / j.total_posts) * 100));
                return (
                  <tr key={j.id} className="border-b border-border/40">
                    <td className="px-2 py-2 max-w-[160px] truncate">{j.channel_name}</td>
                    <td className="px-2 py-2 text-xs">{j.mode_posting}</td>
                    <td className="px-2 py-2 min-w-[140px]">
                      <Progress value={pct} className="h-2" />
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {j.sent_count + j.failed_count} / {j.total_posts}
                      </div>
                    </td>
                    <td className="px-2 py-2">{j.sent_count}</td>
                    <td className="px-2 py-2">{j.failed_count}</td>
                    <td className={`px-2 py-2 text-xs font-bold uppercase ${STATUS_COLOR[j.status] || ""}`}>
                      {j.status}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Test 1 Post"
                          onClick={() => action(testFn, j.id, "Test post terkirim")}>
                          <FlaskConical className="h-4 w-4" />
                        </Button>
                        {j.status !== "running" && j.status !== "completed" && (
                          <Button size="icon" variant="ghost" title="Start"
                            onClick={() => action(j.status === "paused" ? resumeFn : startFn, j.id, "Job dijalankan")}>
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {j.status === "running" && (
                          <Button size="icon" variant="ghost" title="Pause"
                            onClick={() => action(pauseFn, j.id, "Dijeda")}>
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {(j.status === "running" || j.status === "paused") && (
                          <Button size="icon" variant="ghost" title="Stop"
                            onClick={() => action(stopFn, j.id, "Dihentikan")}>
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        {(j.status === "error" || j.status === "stopped") && (
                          <Button size="icon" variant="ghost" title="Retry"
                            onClick={() => action(retryFn, j.id, "Retry")}>
                            <RefreshCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button asChild size="icon" variant="ghost" title="Logs">
                          <a href={`/auto-posting?job=${j.id}`}><Eye className="h-4 w-4" /></a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
