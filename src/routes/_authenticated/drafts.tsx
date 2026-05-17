import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2, PencilLine, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/drafts")({
  component: DraftsPage,
});

type Draft = {
  id: string;
  title: string;
  caption: string;
  media: any[];
  telegram_account_id: string | null;
  scheduled_at: string | null;
  updated_at: string;
};

function DraftsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_drafts")
      .select("id,title,caption,media,telegram_account_id,scheduled_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data || []) as Draft[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Hapus draft ini?")) return;
    const { error } = await supabase.from("content_drafts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Draft dihapus");
      setItems((p) => p.filter((d) => d.id !== id));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Drafts" subtitle="Semua draft postingan tersimpan otomatis di sini" />

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/posts/new">
            <PencilLine className="mr-2 h-4 w-4" /> Buat Postingan Baru
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="panel rounded-2xl p-10 text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-60" />
          Belum ada draft. Mulai menulis di editor, sistem akan menyimpan otomatis.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((d) => {
            const firstMedia = Array.isArray(d.media) ? d.media[0] : null;
            const thumb = firstMedia?.thumb_url || firstMedia?.url;
            return (
              <div
                key={d.id}
                className="panel flex gap-3 rounded-2xl p-3 transition hover:border-[var(--neon-cyan)]/40"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No media
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.title || "(tanpa judul)"}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">
                    {d.caption || "(belum ada caption)"}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {new Date(d.updated_at).toLocaleString()}
                    {d.scheduled_at && ` · jadwal ${new Date(d.scheduled_at).toLocaleString()}`}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => nav({ to: "/drafts/$draftId/edit", params: { draftId: d.id } })}
                    >
                      <PencilLine className="mr-1 h-3 w-3" /> Buka
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(d.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
