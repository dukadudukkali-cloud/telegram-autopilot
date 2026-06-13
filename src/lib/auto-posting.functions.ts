import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JobInput = {
  channel_id: string;
  mode_posting: "manual_queue" | "auto_db" | "auto_caption_ai" | "full_ai";
  image_source: "library" | "channel_content" | "ai_generate";
  caption_source: "template" | "random_template" | "ai_rewrite" | "ai_generate";
  total_posts: number;
  interval_seconds: number;
  button_account_id?: string | null;
  ai_theme?: string | null;
  ai_keywords?: string | null;
};

export const listAutoJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("auto_posting_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export const getAutoJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("auto_posting_jobs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return job;
  });

export const listJobLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: logs } = await context.supabase
      .from("auto_posting_logs")
      .select("*")
      .eq("job_id", data.job_id)
      .order("created_at", { ascending: false })
      .limit(200);
    return logs ?? [];
  });

export const createAutoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: JobInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ch } = await supabase
      .from("telegram_configs")
      .select("id, channel_name, bot_token, channel_id, is_connected")
      .eq("id", data.channel_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!ch) throw new Error("Channel tidak ditemukan");
    if (!ch.bot_token || !ch.channel_id) throw new Error("Bot token / channel ID belum lengkap.");

    const { data: row, error } = await supabase
      .from("auto_posting_jobs")
      .insert({
        user_id: userId,
        channel_id: ch.id,
        channel_name: ch.channel_name,
        mode_posting: data.mode_posting,
        image_source: data.image_source,
        caption_source: data.caption_source,
        total_posts: Math.max(1, Math.min(1000, data.total_posts)),
        interval_seconds: Math.max(15, Math.min(86400, data.interval_seconds)),
        button_account_id: data.button_account_id ?? ch.id,
        ai_theme: data.ai_theme ?? null,
        ai_keywords: data.ai_keywords ?? null,
        status: "idle",
      })
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const startAutoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("auto_posting_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        next_run_at: new Date().toISOString(),
        consecutive_failures: 0,
        last_error: null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const pauseAutoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("auto_posting_jobs")
      .update({ status: "paused", paused_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const resumeAutoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("auto_posting_jobs")
      .update({
        status: "running",
        next_run_at: new Date().toISOString(),
        consecutive_failures: 0,
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const stopAutoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("auto_posting_jobs")
      .update({ status: "stopped", stopped_at: new Date().toISOString(), next_run_at: null })
      .eq("id", data.id);
    return { ok: true };
  });

export const retryFailedAutoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("auto_posting_jobs")
      .update({
        status: "running",
        consecutive_failures: 0,
        next_run_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const runTestPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job } = await supabase
      .from("auto_posting_jobs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!job) throw new Error("Job tidak ditemukan");
    // Load admin client to call worker once (RLS-bypass for the same user is fine since
    // we only operate on this user's rows).
    const { runJobOnce } = await import("./auto-posting.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await runJobOnce(supabaseAdmin, job);
    return r;
  });
