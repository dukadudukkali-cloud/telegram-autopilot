import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAutoPostingStats } from "@/lib/auto-posting-bulk.functions";
import {
  Send,
  Clock,
  FileText,
  XCircle,
  Layers,
} from "lucide-react";

const items = [
  { key: "total", label: "Total Postingan", icon: Layers, color: "text-cyan-400" },
  { key: "sent", label: "Terkirim", icon: Send, color: "text-emerald-400" },
  { key: "scheduled", label: "Terjadwal", icon: Clock, color: "text-amber-400" },
  { key: "draft", label: "Draf", icon: FileText, color: "text-slate-300" },
  { key: "failed", label: "Gagal", icon: XCircle, color: "text-rose-400" },
] as const;

export function StatsHeader() {
  const fn = useServerFn(getAutoPostingStats);
  const { data, isLoading } = useQuery({
    queryKey: ["auto-posting-stats"],
    queryFn: () => fn(),
    refetchInterval: 15_000,
  });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => {
        const Icon = it.icon;
        const value = (data as any)?.[it.key] ?? 0;
        return (
          <div
            key={it.key}
            className="panel relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4 backdrop-blur"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {it.label}
                </p>
                <p className={`mt-2 text-3xl font-bold ${it.color}`}>
                  {isLoading ? "—" : value.toLocaleString("id-ID")}
                </p>
              </div>
              <div className={`rounded-xl bg-background/60 p-2 ${it.color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-40 ${it.color}`}
            />
          </div>
        );
      })}
    </div>
  );
}
