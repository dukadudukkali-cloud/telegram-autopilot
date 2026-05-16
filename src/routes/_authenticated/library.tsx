import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { MediaUploader, type MediaItem } from "@/components/MediaUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Search,
  Star,
  Trash2,
  Copy,
  Send,
  LayoutGrid,
  List,
  Image as ImageIcon,
  Film,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

type LibItem = {
  id: string;
  type: string;
  title: string;
  caption: string | null;
  media_url: string | null;
  thumb_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  tags: string[];
  category: string | null;
  brand: string | null;
  is_favorite: boolean;
  used_count: number;
  last_used_at: string | null;
  created_at: string;
};

function LibraryPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<LibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<MediaItem[]>([]);
  const [draftTitle, setDraftTitle] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("content_library")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data as LibItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (typeFilter !== "all" && it.type !== typeFilter) return false;
      if (q) {
        const hay = `${it.title} ${it.caption || ""} ${(it.tags || []).join(" ")} ${it.brand || ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, q, typeFilter]);

  const saveDraft = async () => {
    if (draft.length === 0 && !draftTitle) {
      toast.error("Tambah judul atau upload media");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const rows = draft.length
      ? draft.map((m) => ({
          user_id: u.user!.id,
          type: m.type,
          title: draftTitle || m.name || "Untitled",
          media_url: m.url,
          thumb_url: m.thumb_url ?? null,
          file_size: m.file_size ?? null,
          mime_type: m.mime_type ?? null,
        }))
      : [{ user_id: u.user.id, type: "caption", title: draftTitle }];
    const { error } = await supabase.from("content_library").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Disimpan ke library");
    setDraft([]);
    setDraftTitle("");
    setAdding(false);
    load();
  };

  const toggleFav = async (it: LibItem) => {
    await supabase.from("content_library").update({ is_favorite: !it.is_favorite }).eq("id", it.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus item ini?")) return;
    await supabase.from("content_library").delete().eq("id", id);
    load();
  };

  const duplicate = async (it: LibItem) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { id, created_at, ...rest } = it as any;
    await supabase.from("content_library").insert({ ...rest, title: `${it.title} (copy)`, user_id: u.user.id });
    load();
  };

  const useForPost = async (it: LibItem) => {
    await supabase
      .from("content_library")
      .update({ used_count: it.used_count + 1, last_used_at: new Date().toISOString() })
      .eq("id", it.id);
    // pass payload via sessionStorage (simple, no routing complexity)
    sessionStorage.setItem(
      "library_prefill",
      JSON.stringify({
        title: it.title,
        caption: it.caption,
        media: it.media_url
          ? [{ id: it.id, type: it.type, url: it.media_url, thumb_url: it.thumb_url, mime_type: it.mime_type }]
          : [],
      }),
    );
    nav({ to: "/posts/new" });
  };

  return (
    <div>
      <PageHeader
        title="Library Konten"
        subtitle="Simpan dan kelola bahan postingan reusable"
        actions={
          <Button onClick={() => setAdding((a) => !a)} className="glow">
            <Plus className="mr-2 h-4 w-4" /> Tambah
          </Button>
        }
      />

      {adding && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel mb-6 rounded-2xl p-6"
        >
          <Input
            placeholder="Judul konten"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="mb-3"
          />
          <MediaUploader value={draft} onChange={setDraft} bucket="content-library" max={10} />
          <div className="mt-4 flex gap-2">
            <Button onClick={saveDraft} className="glow">Simpan</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Batal</Button>
          </div>
        </motion.div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari konten, tag, brand…"
            className="pl-9"
          />
        </div>
        <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
          {(["all", "image", "video"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded px-3 py-1 text-xs uppercase tracking-wider transition ${
                typeFilter === t ? "bg-[var(--neon-cyan)] text-background" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
          <button
            onClick={() => setView("grid")}
            className={`rounded p-1.5 ${view === "grid" ? "bg-[var(--neon-cyan)] text-background" : ""}`}
            aria-label="Grid"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded p-1.5 ${view === "list" ? "bg-[var(--neon-cyan)] text-background" : ""}`}
            aria-label="List"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Belum ada konten. Klik <strong>Tambah</strong> untuk upload bahan.
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((it) => (
            <motion.div
              key={it.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="panel group overflow-hidden rounded-2xl"
            >
              <div className="relative aspect-square bg-muted">
                {it.thumb_url || it.media_url ? (
                  <img
                    src={it.thumb_url || it.media_url || ""}
                    alt={it.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] backdrop-blur">
                  {it.type === "image" ? <ImageIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                  {it.type.toUpperCase()}
                </div>
                <button
                  onClick={() => toggleFav(it)}
                  className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 backdrop-blur"
                  aria-label="Favorite"
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      it.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                    }`}
                  />
                </button>
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-medium">{it.title}</div>
                <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                  {it.brand || it.category || `Dipakai ${it.used_count}x`}
                </div>
                <div className="mt-3 flex gap-1">
                  <Button size="sm" className="flex-1 glow" onClick={() => useForPost(it)}>
                    <Send className="mr-1 h-3 w-3" /> Posting
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(it)} aria-label="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(it.id)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="panel divide-y divide-border rounded-2xl">
          {filtered.map((it) => (
            <div key={it.id} className="flex items-center gap-3 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                {it.thumb_url || it.media_url ? (
                  <img src={it.thumb_url || it.media_url || ""} alt={it.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{it.title}</div>
                <div className="text-xs text-muted-foreground">
                  {it.type} · dipakai {it.used_count}x
                </div>
              </div>
              <Button size="sm" onClick={() => useForPost(it)}>
                <Send className="mr-1 h-3 w-3" /> Posting
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
