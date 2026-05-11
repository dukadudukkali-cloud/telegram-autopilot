import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { testTelegramConnection } from "@/lib/telegram.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Send, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/telegram-setup")({
  component: TelegramSetupPage,
});

function maskToken(t?: string) {
  if (!t) return "";
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 4)}••••••••${t.slice(-4)}`;
}

function TelegramSetupPage() {
  const [config, setConfig] = useState<any | null>(null);
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const testFn = useServerFn(testTelegramConnection);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("telegram_configs")
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setConfig(data);
    if (data) {
      setChannelId(data.channel_id);
      setChannelName(data.channel_name || "");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const payload = {
      user_id: u.user.id,
      bot_token: botToken || config?.bot_token,
      channel_id: channelId,
      channel_name: channelName,
    };
    if (!payload.bot_token) {
      toast.error("Bot token wajib diisi");
      setBusy(false);
      return;
    }

    let id = config?.id;
    if (config) {
      const { error } = await supabase.from("telegram_configs").update(payload).eq("id", config.id);
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("telegram_configs")
        .insert(payload)
        .select()
        .single();
      if (error) toast.error(error.message);
      else id = data.id;
    }
    setBotToken("");
    await load();
    setBusy(false);
    if (id) {
      const r = await testFn({ data: { configId: id } });
      if (r.ok) toast.success(`Terhubung ke @${(r as any).bot?.username}`);
      else toast.error(`Test gagal: ${(r as any).error}`);
      await load();
    } else {
      toast.success("Disimpan");
    }
  }

  async function testNow() {
    if (!config) return;
    setBusy(true);
    const r = await testFn({ data: { configId: config.id } });
    setBusy(false);
    if (r.ok) toast.success(`Terhubung ke @${(r as any).bot?.username}`);
    else toast.error(`Test gagal: ${(r as any).error}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Telegram Setup"
        subtitle="Hubungkan bot dan channel kamu. Token disimpan aman di backend."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={save} className="panel rounded-2xl p-6 lg:col-span-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="bot-token">Bot Token</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="bot-token"
                  type={showToken ? "text" : "password"}
                  placeholder={
                    config ? maskToken(config.bot_token) : "1234567890:ABC-DEF…"
                  }
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => setShowToken((s) => !s)}>
                  {showToken ? "Hide" : "Show"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dapat dari @BotFather. Kosongkan untuk tetap memakai token tersimpan.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ch-id">Channel ID / @username</Label>
                <Input
                  id="ch-id"
                  required
                  placeholder="@nama_channel atau -100xxxxxxxxxx"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ch-name">Nama Channel</Label>
                <Input
                  id="ch-name"
                  placeholder="(opsional, otomatis terisi saat test)"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={busy} className="glow">
                <Send className="mr-2 h-4 w-4" />
                {busy ? "Memproses…" : "Simpan & Test"}
              </Button>
              {config && (
                <Button type="button" variant="secondary" disabled={busy} onClick={testNow}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Test Koneksi
                </Button>
              )}
            </div>
          </div>
        </form>

        <div className="panel rounded-2xl p-6">
          <h2 className="font-display text-lg font-semibold">Status</h2>
          {config ? (
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Bot" value={config.bot_username ? `@${config.bot_username}` : "—"} />
              <Row label="Channel" value={config.channel_name || config.channel_id} />
              <Row label="Token" value={maskToken(config.bot_token)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Koneksi</span>
                {config.is_connected ? (
                  <span className="flex items-center gap-1 font-semibold text-[var(--success)]">
                    <CheckCircle2 className="h-4 w-4" /> Terhubung
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" /> Belum terhubung
                  </span>
                )}
              </div>
              {config.last_tested_at && (
                <Row
                  label="Test terakhir"
                  value={new Date(config.last_tested_at).toLocaleString("id-ID")}
                />
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada konfigurasi.</p>
          )}
          <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Tips:</strong> Tambahkan bot kamu sebagai admin di
            channel agar bisa kirim postingan.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
