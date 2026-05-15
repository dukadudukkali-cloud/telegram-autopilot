import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/telegram-buttons")({
  component: TelegramButtonsPage,
});

type Account = {
  id: string;
  bot_name: string;
  bot_username: string | null;
  channel_id: string;
  channel_name: string | null;
};

type Btn = {
  id: string;
  telegram_account_id: string;
  button_text: string;
  button_url: string;
  is_active: boolean;
  sort_order: number;
};

function normalizeUrl(u: string): string {
  const t = (u || "").trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function TelegramButtonsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [buttons, setButtons] = useState<Btn[]>([]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("telegram_configs")
        .select("id, bot_name, bot_username, channel_id, channel_name")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true });
      setAccounts((data || []) as Account[]);
      if (data && data.length && !accountId) setAccountId(data[0].id);
    })();
  }, []);

  async function loadButtons(aId: string) {
    const { data } = await supabase
      .from("telegram_inline_buttons")
      .select("*")
      .eq("telegram_account_id", aId)
      .order("sort_order", { ascending: true });
    setButtons((data || []) as Btn[]);
  }

  useEffect(() => {
    if (accountId) loadButtons(accountId);
    else setButtons([]);
  }, [accountId]);

  function openCreate() {
    setEditingId(null);
    setText("");
    setUrl("");
    setActive(true);
    setOpen(true);
  }
  function openEdit(b: Btn) {
    setEditingId(b.id);
    setText(b.button_text);
    setUrl(b.button_url);
    setActive(b.is_active);
    setOpen(true);
  }

  async function save() {
    if (!accountId) return toast.error("Pilih akun dulu");
    if (!text.trim()) return toast.error("Teks tombol wajib diisi");
    const cleanUrl = normalizeUrl(url);
    if (!cleanUrl) return toast.error("URL wajib diisi");
    try {
      // basic URL validation
      new URL(cleanUrl);
    } catch {
      return toast.error("URL tidak valid");
    }
    setBusy(true);
    if (editingId) {
      const { error } = await supabase
        .from("telegram_inline_buttons")
        .update({ button_text: text.trim(), button_url: cleanUrl, is_active: active })
        .eq("id", editingId);
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
    } else {
      const nextOrder = buttons.length ? Math.max(...buttons.map((b) => b.sort_order)) + 1 : 0;
      const { error } = await supabase.from("telegram_inline_buttons").insert({
        telegram_account_id: accountId,
        button_text: text.trim(),
        button_url: cleanUrl,
        is_active: active,
        sort_order: nextOrder,
      });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setOpen(false);
    toast.success(editingId ? "Tombol diperbarui" : "Tombol ditambahkan");
    loadButtons(accountId);
  }

  async function toggleActive(b: Btn) {
    const { error } = await supabase
      .from("telegram_inline_buttons")
      .update({ is_active: !b.is_active })
      .eq("id", b.id);
    if (error) toast.error(error.message);
    else loadButtons(accountId);
  }

  async function remove(b: Btn) {
    if (!confirm("Yakin ingin menghapus tombol ini?")) return;
    const { error } = await supabase.from("telegram_inline_buttons").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Tombol dihapus");
      loadButtons(accountId);
    }
  }

  async function move(b: Btn, dir: -1 | 1) {
    const idx = buttons.findIndex((x) => x.id === b.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= buttons.length) return;
    const other = buttons[swapIdx];
    await Promise.all([
      supabase.from("telegram_inline_buttons").update({ sort_order: other.sort_order }).eq("id", b.id),
      supabase.from("telegram_inline_buttons").update({ sort_order: b.sort_order }).eq("id", other.id),
    ]);
    loadButtons(accountId);
  }

  const activeButtons = buttons.filter((b) => b.is_active);

  return (
    <div>
      <PageHeader
        title="Pengaturan Tombol Inline"
        subtitle="Kelola tombol inline per akun Telegram. Tombol aktif otomatis ikut di setiap posting."
        actions={
          <Button onClick={openCreate} disabled={!accountId} className="glow">
            <Plus className="mr-2 h-4 w-4" /> Tambah Tombol
          </Button>
        }
      />

      <div className="panel mb-6 rounded-2xl p-4">
        <Label htmlFor="acc">Pilih Akun Telegram</Label>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Belum ada akun. Tambahkan dulu di <strong>Telegram Setup</strong>.
          </p>
        ) : (
          <select
            id="acc"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {(a.bot_name || "Bot") + (a.bot_username ? ` (@${a.bot_username})` : "")} →{" "}
                {a.channel_name || a.channel_id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          <div className="panel rounded-2xl">
            {buttons.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Belum ada tombol untuk akun ini.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {buttons.map((b, i) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={i === 0}
                        onClick={() => move(b, -1)}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={i === buttons.length - 1}
                        onClick={() => move(b, 1)}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{b.button_text}</div>
                      <a
                        href={b.button_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {b.button_url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {b.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                      <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(b)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-20">
            <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Preview Tombol Aktif
            </h3>
            <div className="rounded-2xl border border-border bg-[oklch(0.16_0.02_270)] p-4">
              {activeButtons.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  Tidak ada tombol aktif. Posting akan dikirim tanpa tombol.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {activeButtons.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-md bg-[oklch(0.28_0.04_275)] px-3 py-2 text-center text-xs font-medium"
                    >
                      {b.button_text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Tombol" : "Tambah Tombol"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bt">Teks Tombol</Label>
              <Input
                id="bt"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="LOGIN"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bu">URL</Label>
              <Input
                id="bu"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Otomatis ditambahkan <code>https://</code> jika belum ada.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ba">Aktif</Label>
              <Switch id="ba" checked={active} onCheckedChange={setActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={save} disabled={busy} className="glow">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
