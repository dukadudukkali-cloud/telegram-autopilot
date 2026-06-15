import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsHeader } from "@/components/auto-posting/StatsHeader";
import { ChannelPickerModal } from "@/components/auto-posting/ChannelPickerModal";
import { AutoPostWizard } from "@/components/auto-posting/AutoPostWizard";
import { ScheduledTable } from "@/components/auto-posting/ScheduledTable";
import { getSelectedChannels } from "@/lib/auto-posting-bulk.functions";
import { CheckSquare, Rocket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auto-posting")({
  component: AutoPostingPage,
});

function AutoPostingPage() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const getSelFn = useServerFn(getSelectedChannels);
  const { data: selected = [] } = useQuery({
    queryKey: ["selected-channels"],
    queryFn: () => getSelFn(),
  });
  const count = (selected as string[]).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Posting Otomatis" subtitle="Panel kontrol auto posting Telegram" />

      <StatsHeader />

      <div className="panel flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-cyan-500/15 text-cyan-300">{count} channel terpilih</Badge>
          <span className="text-xs text-muted-foreground">Pilihan tersimpan otomatis</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPickerOpen(true)}
            className="border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            PILIH SEMUA
          </Button>
          <Button
            size="lg"
            onClick={() => setWizardOpen(true)}
            disabled={count === 0}
            className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-400 hover:to-teal-400"
          >
            <Rocket className="mr-2 h-4 w-4" />
            AUTO POST MENYELURUH
          </Button>
        </div>
      </div>

      <ScheduledTable />

      <ChannelPickerModal open={pickerOpen} onOpenChange={setPickerOpen} />
      <AutoPostWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
