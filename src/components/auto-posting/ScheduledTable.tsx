import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelScheduledPost,
  listScheduledPosts,
  retryFailedPost,
  runScheduledNow,
} from "@/lib/auto-posting-bulk.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Eye, Play, RotateCw, X } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Terjadwal", cls: "bg-amber-500/15 text-amber-300" },
  processing: { label: "Diproses", cls: "bg-cyan-500/15 text-cyan-300" },
  success: { label: "Terkirim", cls: "bg-emerald-500/15 text-emerald-300" },
  partial: { label: "Sebagian", cls: "bg-orange-500/15 text-orange-300" },
  failed: { label: "Gagal", cls: "bg-rose-500/15 text-rose-300" },
  cancelled: { label: "Dibatalkan", cls: "bg-slate-500/15 text-slate-300" },
};

export function ScheduledTable() {
  const qc = useQueryClient();
  const listFn = useServerFn(listScheduledPosts);
  const cancelFn = useServerFn(cancelScheduledPost);
  const retryFn = useServerFn(retryFailedPost);
  const runFn = useServerFn(runScheduledNow);

  const [preview, setPreview] = useState<any | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["scheduled-posts"],
    queryFn: () => listFn(),
    refetchInterval: 10_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
    qc.invalidateQueries({ queryKey: ["auto-posting-stats"] });
  }

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Dibatalkan");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal"),
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Antri ulang");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal"),
  });
  const runNow = useMutation({
    mutationFn: (id: string) => runFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Akan diproses ≤ 1 menit");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal"),
  });

  return (
    <div className="panel rounded-2xl border border-border/40 bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Jadwal Postingan</h3>
        <Button size="sm" variant="ghost" onClick={() => invalidate()}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">No</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Memuat…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data as any[]).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada jadwal postingan.
                </TableCell>
              </TableRow>
            )}
            {(data as any[]).map((r, i) => {
              const s = STATUS[r.status] ?? { label: r.status, cls: "bg-slate-500/15" };
              const isBulk = typeof r.template_title === "string" && r.template_title.startsWith("__BULK__:");
              const modeLabel = isBulk ? r.template_title.split(":")[1] : "manual";
              return (
                <TableRow key={r.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="text-xs">{(r.channel_names ?? []).join(", ")}</TableCell>
                  <TableCell className="text-xs">{isBulk ? "(auto)" : r.template_title}</TableCell>
                  <TableCell className="text-xs">{modeLabel}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{r.caption_source}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString("id-ID") : "Segera"}
                  </TableCell>
                  <TableCell>
                    <Badge className={s.cls}>{s.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setPreview(r)} title="Preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {r.status === "pending" && r.scheduled_at && (
                        <Button size="icon" variant="ghost" onClick={() => runNow.mutate(r.id)} title="Posting sekarang">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {(r.status === "failed" || r.status === "partial" || r.status === "cancelled") && (
                        <Button size="icon" variant="ghost" onClick={() => retry.mutate(r.id)} title="Retry">
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      )}
                      {r.status === "pending" && (
                        <Button size="icon" variant="ghost" onClick={() => cancel.mutate(r.id)} title="Batalkan">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Postingan</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <p><strong>Channel:</strong> {(preview.channel_names ?? []).join(", ")}</p>
              <p><strong>Status:</strong> {STATUS[preview.status]?.label ?? preview.status}</p>
              <p><strong>Jadwal:</strong> {preview.scheduled_at ? new Date(preview.scheduled_at).toLocaleString("id-ID") : "Segera"}</p>
              {preview.error_message && (
                <p className="text-rose-300"><strong>Error:</strong> {preview.error_message}</p>
              )}
              {preview.image_url && !preview.image_url.startsWith("pending://") && (
                <img src={preview.image_url} alt="" className="max-h-64 rounded-lg" />
              )}
              <div>
                <p className="font-semibold">Caption:</p>
                <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">{preview.caption}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
