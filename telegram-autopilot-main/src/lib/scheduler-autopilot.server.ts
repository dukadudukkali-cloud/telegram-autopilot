import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDueSchedulesSrv } from "@/lib/telegram.server";

let started = false;

// Starts a best-effort background loop when server runtime boots.
// Note: This requires a long-lived server process (dev server). For production,
// use an external cron calling the server function.
export function startSchedulerAutopilot() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const { data: userData } = await supabaseAdmin.auth.getUser();
      const user = userData?.user;
      if (!user) return;

      // Single posting per tick is enforced by runDueSchedulesSrv.
      await runDueSchedulesSrv(supabaseAdmin, user.id);
    } catch {
      // swallow to keep scheduler alive
    }
  };

  // first tick immediately, then every 60s
  void tick();
  setInterval(() => {
    void tick();
  }, 60_000);
}
