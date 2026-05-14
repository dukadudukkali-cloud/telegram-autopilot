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

function SchedulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const runFn = useServerFn(runDueSchedules);

  async function load() {
    const { data } = await supabase
      .from("schedules")
      .select("*, posts(title, image_url)")
      .order("scheduled_at", { ascending: true });
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function runNow() {
    const r = await runFn({});
    toast.success(`Dijalankan. Diproses: ${r.processed}`);
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
        subtitle="Jadwal otomatis untuk channel kamu"
        actions={<Button onClick={runNow} className="glow"><Play className="mr-2 h-4 w-4" />Jalankan jadwal due</Button>}
      />
      <div className="panel rounded-2xl">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Postingan</th><th className="p-3">Jadwal</th><th className="p-3">Repeat</th><th className="p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada jadwal.</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {s.posts?.image_url ? <img src={s.posts.image_url} className="h-10 w-10 rounded object-cover" alt="" /> : <div className="h-10 w-10 rounded bg-muted" />}
                    <span className="font-medium">{s.posts?.title || "(post)"}</span>
                  </div>
                </td>
                <td className="p-3">{new Date(s.scheduled_at).toLocaleString("id-ID")}</td>
                <td className="p-3 capitalize">{s.repeat_type}</td>
                <td className="p-3"><span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase">{s.status}</span></td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Tip: Untuk eksekusi otomatis berkala, atur cron eksternal untuk memanggil server function <code>runDueSchedules</code> tiap menit.
      </p>
    </div>
  );
}
