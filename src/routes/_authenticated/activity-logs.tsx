import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/activity-logs")({
  component: LogsPage,
});

function LogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200);
      setRows(data || []);
    })();
  }, []);
  return (
    <div>
      <PageHeader title="Log Aktivitas" subtitle="200 aktivitas terbaru" />
      <div className="panel rounded-2xl">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Waktu</th><th className="p-3">Aksi</th><th className="p-3">Entity</th><th className="p-3">Metadata</th></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Belum ada log.</td></tr>}
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-muted/20">
                <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("id-ID")}</td>
                <td className="p-3 font-medium">{l.action}</td>
                <td className="p-3 text-xs text-muted-foreground">{l.entity || "—"}</td>
                <td className="p-3 text-xs"><code className="rounded bg-muted/40 px-1">{JSON.stringify(l.metadata)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
