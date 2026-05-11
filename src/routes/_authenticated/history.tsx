import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { sendPostToTelegram } from "@/lib/telegram.functions";
import { toast } from "sonner";
import { RefreshCw, Send, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const sendFn = useServerFn(sendPostToTelegram);

  async function load() {
    let q = supabase.from("posts").select("*").neq("status", "deleted").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows(data || []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function repost(id: string) {
    const r = await sendFn({ data: { postId: id } });
    if (r.ok) toast.success("Terkirim ulang"); else toast.error((r as any).error);
    load();
  }
  async function softDelete(id: string) {
    if (!confirm("Pindahkan ke Riwayat Hapus?")) return;
    const { error } = await supabase.from("posts").update({ status: "deleted" }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Dipindah ke Trash"); load(); }
  }

  return (
    <div>
      <PageHeader
        title="Riwayat Posting"
        subtitle="Semua postingan kamu"
        actions={
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Semua</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="posted">Posted</option>
            <option value="failed">Failed</option>
          </select>
        }
      />

      <div className="panel rounded-2xl">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Postingan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Dibuat</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Belum ada postingan.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                    ) : <div className="h-10 w-10 rounded-md bg-muted" />}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.title || "(tanpa judul)"}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{p.caption}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3"><span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase">{p.status}</span></td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("id-ID")}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button asChild size="sm" variant="ghost"><Link to="/posts/$postId/edit" params={{ postId: p.id }}>Edit</Link></Button>
                    <Button size="sm" variant="ghost" onClick={() => repost(p.id)}><Send className="mr-1 h-3 w-3" />Kirim</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => softDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" size="sm" onClick={load} className="mt-3"><RefreshCw className="mr-1 h-3 w-3" />Refresh</Button>
    </div>
  );
}
