// Thin server functions wrapper. Do NOT add helpers here (keep import graph clean).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  testTelegramConnectionSrv,
  sendPostToTelegramSrv,
  deleteTelegramMessageSrv,
  runDueSchedulesSrv,
} from "./telegram.server";

export const testTelegramConnection = createServerFn({ method: "POST" })
  // .middleware([requireSupabaseAuth])
  .inputValidator((d: { configId: string }) => d)
  .handler(async ({ data, context }) => {
    return await testTelegramConnectionSrv(context.supabase, "dummy-user", data.configId);
  });

export const sendPostToTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data, context }) => {
    return await sendPostToTelegramSrv(context.supabase, context.userId, data.postId);
  });

export const deleteTelegramMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data, context }) => {
    return await deleteTelegramMessageSrv(context.supabase, context.userId, data.postId);
  });

export const runDueSchedules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await runDueSchedulesSrv(context.supabase, context.userId);
  });
