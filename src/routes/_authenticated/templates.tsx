import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  PencilLine,
  LayoutTemplate,
  Play,
} from "lucide-react";
import { applyVariables, extractVariables, isValidUrl } from "@/lib/content-utils";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

type Tpl = {
  id: string;
  name: string;
  category: string;
  caption: string;
  variables: string[];
  default_buttons: { button_text: string; button_url: string }[];
  description: string | null;
  use_count: number;
  updated_at: string;
};

const emptyForm = (): Partial<Tpl> => ({
  name: "",
  category: "general",
  caption: "",
  variables: [],
  default_buttons: [],
  description: "",
});

function TemplatesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Tpl>>(emptyForm());
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyTpl, setApplyTpl] = useState<Tpl | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data || []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(emptyForm());
    setEditOpen(true);
  }

  function openEdit(t: Tpl) {
    setEditing({ ...t });
    setEditOpen(true);
  }

  // Auto-detect variables from caption
  const detectedVars = useMemo(
    () => extractVariables(editing.caption || ""),
    [editing.caption],
  );

  async function save() {
    if (!editing.name?.trim()) return toast.error("Nama template wajib diisi");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const buttons = (editing.default_buttons || []).filter((b) => b.button_text && b.button_url);
    for (const b of buttons) {
      if (!isValidUrl(b.button_url)) return toast.error(`URL "${b.button_text}" tidak valid`);
    }

    const payload = {
      user_id: u.user.id,
      name: editing.name.trim(),
      category: editing.category || "general",
      caption: editing.caption || "",
      variables: detectedVars,
      default_buttons: buttons,
      description: editing.description || null,
    } as any;

    if (editing.id) {
      const { error } = await supabase
        .from("content_templates")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Template diperbarui");
    } else {
      const { error } = await supabase.from("content_templates").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Template dibuat");
    }
    setEditOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Hapus template ini?")) return;
    const { error } = await supabase.from("content_templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Dihapus");
      setItems((p) => p.filter((t) => t.id !== id));
    }
  }

  function startApply(t: Tpl) {
    setApplyTpl(t);
    const init: Record<string, string> = {};
    (t.variables || []).forEach((v) => (init[v] = ""));
    setVarValues(init);
    setApplyOpen(true);
  }

  async function confirmApply() {
    if (!applyTpl) return;
    const finalCaption = applyVariables(applyTpl.caption, varValues);
    sessionStorage.setItem(
      "template_apply",
      JSON.stringify({ caption: finalCaption, title: applyTpl.name }),
    );
    // bump usage
    await supabase
      .from("content_templates")
      .update({ use_count: (applyTpl.use_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", applyTpl.id);
    setApplyOpen(false);
    nav({ to: "/posts/new" });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Template Konten"
        subtitle="Buat template caption reusable dengan variable seperti {brand}, {tanggal}"
      />

      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Template Baru
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="panel rounded-2xl p-10 text-center text-muted-foreground">
          <LayoutTemplate className="mx-auto mb-2 h-8 w-8 opacity-60" />
          Belum ada template. Buat template pertama Anda.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <div key={t.id} className="panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.category} · dipakai {t.use_count || 0}x
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                    <PencilLine className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(t.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.caption}</p>
              {t.variables?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.variables.map((v) => (
                    <span
                      key={v}
                      className="rounded bg-[oklch(0.25_0.05_275)] px-1.5 py-0.5 text-[10px]"
                    >
                      {`{${v}}`}
                    </span>
                  ))}
                </div>
              )}
              <Button size="sm" className="mt-3 w-full" onClick={() => startApply(t)}>
                <Play className="mr-2 h-3.5 w-3.5" /> Pakai Template
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit Template" : "Template Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nama</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Promo Harian"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <Input
                  value={editing.category || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, category: e.target.value }))}
                  placeholder="promo / news / general"
                />
              </div>
            </div>
            <div>
              <Label>Deskripsi (opsional)</Label>
              <Input
                value={editing.description || ""}
                onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Isi Caption</Label>
              <Textarea
                rows={7}
                value={editing.caption || ""}
                onChange={(e) => setEditing((p) => ({ ...p, caption: e.target.value }))}
                placeholder={"Halo {brand}!\nPromo hari ini berlaku sampai {tanggal}.\nDaftar di {link}"}
                className="font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tulis variable dengan format <code>{`{nama}`}</code>. Contoh: {`{brand}`},{" "}
                {`{tanggal}`}, {`{nomor}`}, {`{link}`}.
              </p>
              {detectedVars.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detectedVars.map((v) => (
                    <span
                      key={v}
                      className="rounded bg-[oklch(0.25_0.05_275)] px-1.5 py-0.5 text-[10px]"
                    >
                      {`{${v}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Default Button / Link</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setEditing((p) => ({
                      ...p,
                      default_buttons: [
                        ...(p.default_buttons || []),
                        { button_text: "", button_url: "" },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3 w-3" /> Tambah
                </Button>
              </div>
              <div className="space-y-2">
                {(editing.default_buttons || []).map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Teks tombol"
                      value={b.button_text}
                      onChange={(e) =>
                        setEditing((p) => ({
                          ...p,
                          default_buttons: (p.default_buttons || []).map((x, idx) =>
                            idx === i ? { ...x, button_text: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                    <Input
                      placeholder="https://…"
                      value={b.button_url}
                      onChange={(e) =>
                        setEditing((p) => ({
                          ...p,
                          default_buttons: (p.default_buttons || []).map((x, idx) =>
                            idx === i ? { ...x, button_url: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditing((p) => ({
                          ...p,
                          default_buttons: (p.default_buttons || []).filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply variables dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Isi Variable — {applyTpl?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(applyTpl?.variables || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Template ini tidak punya variable. Lanjut ke editor?
              </p>
            ) : (
              (applyTpl?.variables || []).map((v) => (
                <div key={v}>
                  <Label>{v}</Label>
                  <Input
                    value={varValues[v] || ""}
                    onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                    placeholder={`Nilai untuk {${v}}`}
                  />
                </div>
              ))
            )}
            {applyTpl && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Preview Caption
                </div>
                <div className="whitespace-pre-wrap">
                  {applyVariables(applyTpl.caption, varValues)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApplyOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmApply}>Buka di Editor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
