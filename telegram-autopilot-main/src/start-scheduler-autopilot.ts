import { startSchedulerAutopilot } from "@/lib/scheduler-autopilot.server";

// Fire-and-forget: scheduler loop runs in the server runtime (long-lived dev server / worker).
startSchedulerAutopilot();
