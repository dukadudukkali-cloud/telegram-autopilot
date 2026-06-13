import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listCaptionTemplates,
  upsertCaptionTemplate,
  deleteCaptionTemplate,
} from "@/lib/caption-templates.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/caption-templates")({
  component: CaptionTemplatesPage,
});

function CaptionTemplatesPage() {
  const listFn = useServerFn(listCaptionTemplates);
  const saveFn = useServerFn(upsertCaptionTemplate);
  const delFn = useServerFn(deleteCaptionTemplate);
  const [rows, setRows] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [form, setForm] = useState({
    id: "" as string | undefined,
    channel_id: "" as string | null,
    template_name: "",
    caption_text: "",
    status: "active" as "active" | "inactive",
  });

  async function refresh() {
    const d = await listFn();
    setRows(d as any);
  }
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("telegram_configs").select("id, channel_name");
      setChannels(data ?? []);
      refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!form.template_name || !form.caption_text) return toast.error("Nama dan caption wajib diisi");
    try {
      const ch = channels.find((c) => c.id === form.channel_id);
      await saveFn({
        data: {
          id: form.id || undefined,
          channel_id: form.channel_id || null,
          channel_name: ch?.channel_name ?? null,
          template_name: form.template_name,
          caption_text: form.caption_text,
          status: form.status,
        },
      });
      toast.success("Tersimpan");
      setForm({ id: "", channel_id: "", template_name: "", caption_text: "", status: "active" });
      refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  }

  return (
    <div>
      <PageHeader title="Template Caption" subtitle="Template caption per-channel untuk auto posting" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-2xl p-5">
          <h3 className="font-display text-lg font-semibold">{form.id ? "Edit Template" : "Template Baru"}</h3>
          <div className="mt-3 space-y-3">
            <div>
              <Label>Channel (opsional)</Label>
              <Select value={form.channel_id ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, channel_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Semua channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua channel</SelectItem>
                  {channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nama Template</Label>
              <Input value={form.template_name} onChange={(e) => setForm((f) => ({ ...f, template_name: e.target.value }))} />
            </div>
            <div>
              <Label>Caption</Label>
              <Textarea rows={6} value={form.caption_text} onChange={(e) => setForm((f) => ({ ...f, caption_text: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} className="glow">Simpan</Button>
              {form.id && (
                <Button variant="ghost" onClick={() => setForm({ id: "", channel_id: "", template_name: "", caption_text: "", status: "active" })}>
                  Batal
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="panel rounded-2xl p-5">
          <h3 className="font-display text-lg font-semibold">Daftar Template</h3>
          <div className="mt-3 divide-y divide-border/40">
            {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Belum ada template.</p>}
            {rows.map((r) => (
              <div key={r.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="text-left"
                    onClick={() => setForm({ id: r.id, channel_id: r.channel_id ?? "", template_name: r.template_name, caption_text: r.caption_text, status: r.status })}
                  >
                    <div className="text-sm font-semibold">{r.template_name}</div>
                    <div className="text-xs text-muted-foreground">{r.channel_name || "Semua channel"}</div>
                  </button>
                  <Button size="icon" variant="ghost" onClick={async () => { await delFn({ data: { id: r.id } }); refresh(); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.caption_text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
