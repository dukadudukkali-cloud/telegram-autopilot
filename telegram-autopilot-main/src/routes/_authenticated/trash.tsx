import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trash")({
  component: TrashPage,
});

function TrashPage() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase
      .from("deleted_posts_history")
      .select("*")
      .order("deleted_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function restore(row: any) {
    const { error } = await supabase
      .from("posts")
      .update({ status: "draft" })
      .eq("id", row.original_post_id);
    if (error) return toast.error(error.message);
    await supabase.from("deleted_posts_history").update({ restored: true }).eq("id", row.id);
    toast.success("Dipulihkan sebagai draft");
    load();
  }
  async function purge(row: any) {
    if (!confirm("Hapus permanen? Tindakan ini tidak bisa dibatalkan.")) return;
    await supabase.from("schedules").delete().eq("post_id", row.original_post_id);
    await supabase.from("post_buttons").delete().eq("post_id", row.original_post_id);
    await supabase.from("posts").delete().eq("id", row.original_post_id);
    await supabase.from("deleted_posts_history").delete().eq("id", row.id);
    toast.success("Dihapus permanen");
    load();
  }

  return (
    <div>
      <PageHeader
        title="Riwayat Hapus"
        subtitle="Postingan yang dihapus dapat dipulihkan atau dihapus permanen"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">Trash kosong.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="panel rounded-2xl p-4">
            {r.image_url ? (
              <img src={r.image_url} className="mb-3 h-40 w-full rounded-lg object-cover" alt="" />
            ) : (
              <div className="mb-3 h-40 w-full rounded-lg bg-muted" />
            )}
            <h3 className="font-semibold">{r.title || "(tanpa judul)"}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.caption}</p>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Dihapus {new Date(r.deleted_at).toLocaleString("id-ID")}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => restore(r)}
                disabled={r.restored}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restore
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => purge(r)}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Permanen
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
