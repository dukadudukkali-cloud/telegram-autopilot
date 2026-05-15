import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { runDueSchedules } from "@/lib/telegram.functions";
import { toast } from "sonner";
import { Play, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/schedules")({
  component: SchedulesPage,
});

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-sky-500/20 text-sky-300",
  pending: "bg-sky-500/20 text-sky-300",
  queued: "bg-amber-500/20 text-amber-300",
  processing: "bg-violet-500/20 text-violet-300 animate-pulse",
  sent: "bg-emerald-500/20 text-emerald-300",
  success: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-red-500/20 text-red-300",
};

function fmtCountdown(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "siap diproses";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (m > 60) {
    const h = Math.floor(m / 60);
    return `${h}j ${m % 60}m`;
  }
  return `${m}m ${s}s`;
}

function SchedulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [, setTick] = useState(0);
  const runFn = useServerFn(runDueSchedules);

  async function load() {
    const { data } = await supabase
      .from("schedules")
      .select("*, posts(title, image_url, error_message)")
      .order("scheduled_at", { ascending: true });
    setRows(data || []);
  }
  useEffect(() => {
    load();
    const poll = setInterval(load, 10000);
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  async function runNow() {
    const r = await runFn({});
    toast.success(`Dijalankan. Diproses: ${r.processed}, antri: ${r.queued}`);
    load();
  }
  async function del(id: string) {
    if (!confirm("Hapus jadwal?")) return;
    await supabase.from("schedules").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Jadwal Posting"
        subtitle="Scheduler otomatis berjalan tiap menit. Postingan dikirim berurutan dengan jeda 1 menit."
        actions={
          <Button onClick={runNow} className="glow">
            <Play className="mr-2 h-4 w-4" />
            Jalankan sekarang
          </Button>
        }
      />
      <div className="panel rounded-2xl">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Postingan</th>
              <th className="p-3">Jadwal</th>
              <th className="p-3">Repeat</th>
              <th className="p-3">Status</th>
              <th className="p-3">Countdown</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Belum ada jadwal.
                </td>
              </tr>
            )}
            {rows.map((s) => {
              const status = s.status as string;
              const target =
                status === "queued" || status === "processing"
                  ? s.available_at || s.scheduled_at
                  : s.scheduled_at;
              return (
                <tr key={s.id} className="hover:bg-muted/20 align-top">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {s.posts?.image_url ? (
                        <img
                          src={s.posts.image_url}
                          className="h-10 w-10 rounded object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium">{s.posts?.title || "(post)"}</div>
                        {status === "failed" && s.posts?.error_message && (
                          <div className="mt-1 max-w-xs truncate text-xs text-red-300">
                            {s.posts.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{new Date(s.scheduled_at).toLocaleString("id-ID")}</td>
                  <td className="p-3 capitalize">{s.repeat_type}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        STATUS_STYLE[status] || "bg-muted/40"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {status === "sent" || status === "success" || status === "failed"
                      ? "—"
                      : fmtCountdown(target)}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => del(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Production: scheduler dijalankan otomatis tiap menit oleh cron job di backend.
      </p>
    </div>
  );
}
