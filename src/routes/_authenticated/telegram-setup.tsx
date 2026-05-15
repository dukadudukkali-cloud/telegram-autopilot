import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { testTelegramConnection } from "@/lib/telegram.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Loader2, Plus, Power, RefreshCw, Send, Trash2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/telegram-setup")({
  component: TelegramSetupPage,
});

const MAX_ACCOUNTS = 10;

function maskToken(t?: string) {
  if (!t) return "";
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 4)}••••••••${t.slice(-4)}`;
}

type Account = {
  id: string;
  bot_name: string;
  bot_username: string | null;
  bot_token: string;
  channel_id: string;
  channel_name: string | null;
  is_connected: boolean;
  is_active: boolean;
  connection_status: string;
  last_tested_at: string | null;
  last_error: string | null;
};

function TelegramSetupPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [botName, setBotName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [showToken, setShowToken] = useState(false);

  const testFn = useServerFn(testTelegramConnection);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("telegram_configs")
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setAccounts((data || []) as Account[]);
  }
  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setBotName("");
    setBotToken("");
    setChannelId("");
    setChannelName("");
    setShowToken(false);
    setEditingId(null);
  }

  function openCreate() {
    if (accounts.length >= MAX_ACCOUNTS) {
      toast.error(`Maksimal ${MAX_ACCOUNTS} akun Telegram`);
      return;
    }
    resetForm();
    setShowForm(true);
  }

  function openEdit(a: Account) {
    setEditingId(a.id);
    setBotName(a.bot_name || "");
    setBotToken("");
    setChannelId(a.channel_id);
    setChannelName(a.channel_name || "");
    setShowToken(false);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId && !botToken.trim()) return toast.error("Bot token wajib diisi");
    if (!channelId.trim()) return toast.error("Channel ID wajib diisi");

    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    let id = editingId;
    if (editingId) {
      const upd: {
        bot_name: string;
        channel_id: string;
        channel_name: string;
        updated_at: string;
        bot_token?: string;
      } = {
        bot_name: botName,
        channel_id: channelId,
        channel_name: channelName,
        updated_at: new Date().toISOString(),
      };
      if (botToken.trim()) upd.bot_token = botToken.trim();
      const { error } = await supabase.from("telegram_configs").update(upd).eq("id", editingId);
      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("telegram_configs")
        .insert({
          user_id: u.user.id,
          bot_name: botName || "Untitled bot",
          bot_token: botToken.trim(),
          channel_id: channelId,
          channel_name: channelName,
          is_active: true,
          connection_status: "unknown",
        })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
      id = data.id;
    }

    setShowForm(false);
    resetForm();
    await load();

    if (id) {
      await runTest(id);
    }
    setSubmitting(false);
  }

  async function runTest(accountId: string) {
    setBusyId(accountId);
    const tId = toast.loading("Menghubungkan bot...");
    try {
      const r = await testFn({ data: { configId: accountId } });
      console.log("TESTFN RESPONSE:", r);
      if (r?.success) {
        toast.success(`🟢 ${r.message || "Connected"}`, { id: tId });
      } else {
        toast.error(
          `🔴 ${r?.message || JSON.stringify(r) || "Gagal terhubung ke Telegram"}`,
          { id: tId }
        );
      }
    } catch (e: any) {
      console.error("TELEGRAM ERROR:", e);

      const msg =
        e?.telegram?.description ||
        e?.message ||
        JSON.stringify(e);

      toast.error(`🔴 ${msg}`, { id: tId });
    }
  }

  async function reconnect(a: Account) {
    await runTest(a.id);
  }

  async function toggleActive(a: Account) {
    const { error } = await supabase
      .from("telegram_configs")
      .update({ is_active: !a.is_active, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else load();
  }

  async function remove(a: Account) {
    if (!confirm(`Hapus akun "${a.bot_name || a.channel_id}"?`)) return;
    const { error } = await supabase.from("telegram_configs").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Akun dihapus");
      load();
    }
  }

  return (
    <div>
      <PageHeader
        title="Telegram Accounts"
        subtitle={`Kelola hingga ${MAX_ACCOUNTS} bot & channel. Token tersimpan aman di backend.`}
        actions={
          <Button onClick={openCreate} className="glow">
            <Plus className="mr-2 h-4 w-4" /> Tambah Akun
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={submit} className="panel mb-6 rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              {editingId ? "Edit Akun Telegram" : "Tambah Akun Telegram"}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Batal
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="bn">Nama Bot (label)</Label>
              <Input
                id="bn"
                placeholder="Promo Bot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cid">Channel ID / @username</Label>
              <Input
                id="cid"
                required
                placeholder="@nama_channel atau -100xxxxxxxxxx"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="bt">Bot Token</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="bt"
                  type={showToken ? "text" : "password"}
                  placeholder={editingId ? "Kosongkan untuk tetap memakai token tersimpan" : "1234567890:ABC-DEF…"}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => setShowToken((s) => !s)}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dapat dari @BotFather. Token hanya digunakan di backend, tidak pernah di-expose.
              </p>
            </div>
            <div>
              <Label htmlFor="cn">Nama Channel (opsional)</Label>
              <Input
                id="cn"
                placeholder="Otomatis terisi jika kosong"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting} className="glow">
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Simpan & Test
            </Button>
          </div>
        </form>
      )}

      {accounts.length === 0 ? (
        <div className="panel rounded-2xl p-10 text-center">
          <p className="text-muted-foreground">
            Belum ada akun Telegram. Klik <strong>Tambah Akun</strong> untuk mulai.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const connected = a.is_connected && a.connection_status === "connected";
            return (
              <div key={a.id} className="panel rounded-2xl p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-base font-semibold">
                      {a.bot_name || "Untitled bot"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.bot_username ? `@${a.bot_username}` : "—"}
                    </div>
                  </div>
                  {connected ? (
                    <Badge className="border-transparent bg-emerald-500/20 text-emerald-300">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                    </Badge>
                  ) : a.connection_status === "failed" ? (
                    <Badge className="border-transparent bg-red-500/20 text-red-300">
                      <XCircle className="mr-1 h-3 w-3" /> Failed
                    </Badge>
                  ) : (
                    <Badge variant="outline">Belum dites</Badge>
                  )}
                </div>

                <div className="space-y-1.5 text-sm">
                  <Row label="Channel" value={a.channel_name || a.channel_id} />
                  <Row label="Channel ID" value={a.channel_id} mono />
                  <Row label="Token" value={maskToken(a.bot_token)} mono />
                  {a.last_tested_at && (
                    <Row
                      label="Test terakhir"
                      value={new Date(a.last_tested_at).toLocaleString("id-ID")}
                    />
                  )}
                  {!a.is_active && (
                    <div className="text-xs font-semibold uppercase text-amber-400">Disabled</div>
                  )}
                  {a.last_error && (
                    <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                      {a.last_error}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === a.id}
                    onClick={() => reconnect(a)}
                  >
                    {busyId === a.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Reconnect
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(a)}>
                    <Power className="mr-1 h-3 w-3" />
                    {a.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(a)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
