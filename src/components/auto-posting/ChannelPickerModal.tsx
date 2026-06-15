import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllChannels,
  getSelectedChannels,
  saveSelectedChannels,
} from "@/lib/auto-posting-bulk.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, CircleOff } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function StatusBadge({ ch }: { ch: any }) {
  if (!ch.is_active) {
    return (
      <Badge variant="outline" className="border-slate-500/40 text-slate-300">
        <CircleOff className="mr-1 h-3 w-3" /> Tidak Aktif
      </Badge>
    );
  }
  if (ch.is_connected) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="bg-rose-500/15 text-rose-300 hover:bg-rose-500/20">
      <AlertCircle className="mr-1 h-3 w-3" /> Error
    </Badge>
  );
}

export function ChannelPickerModal({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllChannels);
  const getSelFn = useServerFn(getSelectedChannels);
  const saveFn = useServerFn(saveSelectedChannels);

  const { data: channels = [] } = useQuery({
    queryKey: ["all-channels"],
    queryFn: () => listFn(),
    enabled: open,
  });
  const { data: saved = [] } = useQuery({
    queryKey: ["selected-channels"],
    queryFn: () => getSelFn(),
    enabled: open,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set(saved as string[]));
  }, [open, saved]);

  const allChecked = useMemo(
    () => channels.length > 0 && selected.size === channels.length,
    [channels, selected],
  );

  function toggleAll(v: boolean) {
    if (v) setSelected(new Set((channels as any[]).map((c) => c.id)));
    else setSelected(new Set());
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const save = useMutation({
    mutationFn: () => saveFn({ data: { ids: Array.from(selected) } }),
    onSuccess: () => {
      toast.success(`${selected.size} channel disimpan`);
      qc.invalidateQueries({ queryKey: ["selected-channels"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal menyimpan"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pilih Channel Telegram</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(v) => toggleAll(Boolean(v))}
            />
            Pilih Semua Channel
          </label>
          <span className="text-xs text-muted-foreground">
            {selected.size} / {channels.length} dipilih
          </span>
        </div>

        <div className="max-h-[420px] space-y-1 overflow-y-auto py-1">
          {channels.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada channel. Tambahkan di menu Telegram Setup.
            </p>
          )}
          {(channels as any[]).map((ch) => (
            <label
              key={ch.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-transparent px-3 py-2 hover:border-border/60 hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selected.has(ch.id)}
                  onCheckedChange={() => toggle(ch.id)}
                />
                <div>
                  <p className="text-sm font-medium">{ch.channel_name ?? "(tanpa nama)"}</p>
                  <p className="text-xs text-muted-foreground">{ch.channel_id ?? "no chat id"}</p>
                </div>
              </div>
              <StatusBadge ch={ch} />
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Menyimpan…" : "Simpan Pilihan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
