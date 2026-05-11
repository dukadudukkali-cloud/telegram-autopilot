import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("app_settings").select("*").eq("user_id", u.user.id).maybeSingle();
    setS(data);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!s) return;
    setBusy(true);
    const { error } = await supabase.from("app_settings").update({
      app_name: s.app_name,
      posting_delay_ms: s.posting_delay_ms,
      auto_reconnect: s.auto_reconnect,
      dark_mode: s.dark_mode,
      default_channel: s.default_channel,
    }).eq("id", s.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Tersimpan");
  }

  if (!s) return <div className="panel rounded-2xl p-6">Loading…</div>;

  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi aplikasi" />
      <div className="panel rounded-2xl p-6 max-w-2xl space-y-4">
        <div><Label>Nama Aplikasi</Label><Input className="mt-1" value={s.app_name} onChange={(e) => setS({ ...s, app_name: e.target.value })} /></div>
        <div><Label>Default Channel</Label><Input className="mt-1" value={s.default_channel || ""} onChange={(e) => setS({ ...s, default_channel: e.target.value })} /></div>
        <div><Label>Delay Posting (ms)</Label><Input type="number" className="mt-1" value={s.posting_delay_ms} onChange={(e) => setS({ ...s, posting_delay_ms: Number(e.target.value) })} /></div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><Label>Auto Reconnect</Label><p className="text-xs text-muted-foreground">Coba sambungkan ulang otomatis jika gagal</p></div><Switch checked={s.auto_reconnect} onCheckedChange={(v) => setS({ ...s, auto_reconnect: v })} /></div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><Label>Dark Mode</Label><p className="text-xs text-muted-foreground">Tema neon gelap (default)</p></div><Switch checked={s.dark_mode} onCheckedChange={(v) => setS({ ...s, dark_mode: v })} /></div>
        <Button onClick={save} disabled={busy} className="glow">{busy ? "Menyimpan…" : "Simpan"}</Button>
      </div>
    </div>
  );
}
