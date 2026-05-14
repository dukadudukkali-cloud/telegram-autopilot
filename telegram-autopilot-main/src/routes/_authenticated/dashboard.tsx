import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { CalendarClock, CheckCircle2, FileText, History, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Stats = {
  total: number;
  posted: number;
  scheduled: number;
  failed: number;
  draft: number;
  channelConnected: boolean;
  channelName: string;
};

function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: posts } = await supabase.from("posts").select("status");
      const counts = { total: 0, posted: 0, scheduled: 0, failed: 0, draft: 0 };
      (posts || []).forEach((p) => {
        counts.total++;
        if (p.status in counts) (counts as any)[p.status]++;
      });
      const { data: cfg } = await supabase
        .from("telegram_configs")
        .select("is_connected, channel_name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: r } = await supabase
        .from("posts")
        .select("id, title, status, created_at, image_url")
        .order("created_at", { ascending: false })
        .limit(5);
      setStats({
        ...counts,
        channelConnected: cfg?.is_connected ?? false,
        channelName: cfg?.channel_name ?? "",
      });
      setRecent(r || []);
    })();
  }, []);

  const cards = [
    {
      label: "Total Postingan",
      value: stats?.total ?? 0,
      icon: FileText,
      color: "var(--neon-cyan)",
    },
    { label: "Terkirim", value: stats?.posted ?? 0, icon: CheckCircle2, color: "var(--success)" },
    {
      label: "Terjadwal",
      value: stats?.scheduled ?? 0,
      icon: CalendarClock,
      color: "var(--neon-violet)",
    },
    { label: "Gagal", value: stats?.failed ?? 0, icon: XCircle, color: "var(--destructive)" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan aktivitas auto poster Telegram kamu"
        actions={
          <Button asChild className="glow">
            <Link to="/posts/new">+ Buat Postingan</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="panel rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <c.icon className="h-5 w-5" style={{ color: c.color }} />
            </div>
            <div className="mt-3 font-display text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-5 lg:col-span-1">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[var(--neon-cyan)]" />
            <h2 className="font-display text-lg font-semibold">Status Channel</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Koneksi</span>
              <span
                className={
                  stats?.channelConnected
                    ? "font-semibold text-[var(--success)]"
                    : "text-destructive"
                }
              >
                {stats?.channelConnected ? "Terhubung" : "Belum terhubung"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Channel</span>
              <span className="font-medium">{stats?.channelName || "—"}</span>
            </div>
          </div>
          <Button asChild variant="secondary" className="mt-4 w-full">
            <Link to="/telegram-setup">Kelola Bot</Link>
          </Button>
        </div>

        <div className="panel rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--neon-magenta)]" />
              <h2 className="font-display text-lg font-semibold">Postingan Terbaru</h2>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/history">Lihat semua →</Link>
            </Button>
          </div>
          <div className="mt-3 divide-y divide-border/60">
            {recent.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada postingan.</p>
            )}
            {recent.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title || "(tanpa judul)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("id-ID")}
                  </div>
                </div>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
