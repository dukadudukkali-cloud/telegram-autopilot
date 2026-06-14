import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { AutoPostingControl } from "@/components/AutoPostingControl";
import { AutoPostingMultiChannel } from "@/components/AutoPostingMultiChannel";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listJobLogs } from "@/lib/auto-posting.functions";

export const Route = createFileRoute("/_authenticated/auto-posting")({
  validateSearch: (s: Record<string, unknown>) => ({ job: (s.job as string) || "" }),
  component: AutoPostingPage,
});

function AutoPostingPage() {
  const { job } = Route.useSearch();
  const [logs, setLogs] = useState<any[]>([]);
  const fn = useServerFn(listJobLogs);

  useEffect(() => {
    if (!job) return;
    (async () => {
      const data = await fn({ data: { job_id: job } });
      setLogs(data as any);
    })();
  }, [job, fn]);

  return (
    <div>
      <PageHeader title="Auto Posting" subtitle="Pusat kontrol auto posting Telegram" />
      <div className="space-y-6">
        <AutoPostingMultiChannel />
        <AutoPostingControl />
      </div>
      {job && (
        <div className="panel mt-6 rounded-2xl p-5">
          <h3 className="font-display text-lg font-semibold">Logs</h3>
          <div className="mt-3 max-h-[480px] overflow-y-auto divide-y divide-border/40">
            {logs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Belum ada log.</p>}
            {logs.map((l) => (
              <div key={l.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={l.status === "sent" ? "text-[var(--success)]" : "text-destructive"}>
                    {l.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("id-ID")}</span>
                </div>
                {l.caption_text && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{l.caption_text}</p>}
                {l.error_message && <p className="mt-1 text-xs text-destructive">{l.error_message}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
