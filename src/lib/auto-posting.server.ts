// Server-only auto posting worker logic.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPostToTelegramSrv } from "./telegram.server";
import { generateCaption, rewriteCaption, generateImagePrompt, generateImageBase64 } from "./ai.server";

type Job = any;

async function pickImage(supabase: SupabaseClient, job: Job): Promise<{ url: string; libraryId?: string } | null> {
  if (job.image_source === "ai_generate") {
    const prompt = await generateImagePrompt(job.channel_name, job.ai_theme);
    const b64 = await generateImageBase64(prompt);
    const bytes = Buffer.from(b64, "base64");
    const path = `${job.user_id}/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: upErr } = await supabase.storage
      .from("content-library")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Upload AI image failed: ${upErr.message}`);
    const { data: pub } = supabase.storage.from("content-library").getPublicUrl(path);
    const url = pub.publicUrl;
    const { data: row } = await supabase
      .from("content_library")
      .insert({
        user_id: job.user_id,
        type: "image",
        media_url: url,
        channel_id: job.channel_id,
        caption: prompt,
        used_count: 1,
        last_used_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    return { url, libraryId: row?.id };
  }

  // library / channel_content -> least recently used image for this user (optionally scoped to channel)
  let q = supabase
    .from("content_library")
    .select("id, media_url, used_count, last_used_at")
    .eq("user_id", job.user_id)
    .eq("type", "image")
    .order("used_count", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1);
  if (job.image_source === "channel_content") {
    q = q.eq("channel_id", job.channel_id);
  }
  const { data } = await q.maybeSingle();
  if (!data?.media_url) return null;
  await supabase
    .from("content_library")
    .update({ used_count: (data.used_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { url: data.media_url, libraryId: data.id };
}

async function pickCaption(supabase: SupabaseClient, job: Job): Promise<string> {
  // Get a base template caption from caption_templates scoped to user (+channel optional)
  let baseQ = supabase
    .from("caption_templates")
    .select("caption_text")
    .eq("user_id", job.user_id)
    .eq("status", "active");
  if (job.channel_id) baseQ = baseQ.or(`channel_id.eq.${job.channel_id},channel_id.is.null`);
  const { data: templates } = await baseQ;

  const pickRandom = () => {
    if (!templates || templates.length === 0) return "";
    return templates[Math.floor(Math.random() * templates.length)].caption_text || "";
  };

  if (job.caption_source === "template") {
    return templates?.[0]?.caption_text || "";
  }
  if (job.caption_source === "random_template") {
    return pickRandom();
  }
  if (job.caption_source === "ai_rewrite") {
    const base = pickRandom();
    if (!base) return generateCaption({ channelName: job.channel_name, theme: job.ai_theme, keywords: job.ai_keywords });
    return rewriteCaption(base, job.channel_name);
  }
  // ai_generate
  return generateCaption({ channelName: job.channel_name, theme: job.ai_theme, keywords: job.ai_keywords });
}

/** Execute ONE post for the given job. */
export async function runJobOnce(supabase: SupabaseClient, job: Job): Promise<{ ok: boolean; error?: string; message_id?: number }> {
  let image: { url: string; libraryId?: string } | null = null;
  let caption = "";
  try {
    image = await pickImage(supabase, job);
    if (!image) throw new Error("Tidak ada gambar tersedia di library untuk channel ini.");
    caption = await pickCaption(supabase, job);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    await supabase.from("auto_posting_logs").insert({
      job_id: job.id,
      user_id: job.user_id,
      channel_id: job.channel_id,
      image_url: image?.url ?? null,
      caption_text: caption,
      status: "failed",
      error_message: msg,
    });
    return { ok: false, error: msg };
  }

  // Create a transient post row using the job's button account
  const { data: post, error: pErr } = await supabase
    .from("posts")
    .insert({
      user_id: job.user_id,
      title: `Auto: ${job.channel_name || job.channel_id}`,
      caption,
      image_url: image.url,
      media: [{ type: "image", url: image.url }],
      telegram_account_id: job.button_account_id || job.channel_id,
      status: "queued",
      platform: "telegram",
    })
    .select("id")
    .maybeSingle();
  if (pErr || !post) {
    const msg = pErr?.message || "Gagal membuat post sementara";
    await supabase.from("auto_posting_logs").insert({
      job_id: job.id,
      user_id: job.user_id,
      channel_id: job.channel_id,
      image_url: image.url,
      caption_text: caption,
      status: "failed",
      error_message: msg,
    });
    return { ok: false, error: msg };
  }

  const r = await sendPostToTelegramSrv(supabase, job.user_id, post.id);

  await supabase.from("auto_posting_logs").insert({
    job_id: job.id,
    user_id: job.user_id,
    channel_id: job.channel_id,
    post_id: post.id,
    image_url: image.url,
    caption_text: caption,
    telegram_message_id: r.ok ? (r as any).message_id : null,
    status: r.ok ? "sent" : "failed",
    error_message: r.ok ? null : r.error,
    sent_at: r.ok ? new Date().toISOString() : null,
  });
  return r.ok ? { ok: true, message_id: (r as any).message_id } : { ok: false, error: r.error };
}

/** Worker tick: process all running jobs whose next_run_at <= now (admin client). */
export async function runAutoPostingTick(supabase: SupabaseClient): Promise<{ ok: boolean; processed: number }> {
  const nowIso = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from("auto_posting_jobs")
    .select("*")
    .eq("status", "running")
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .limit(20);
  if (error) throw error;

  let processed = 0;
  for (const job of jobs || []) {
    // Atomic-ish lock: bump next_run_at forward so concurrent ticks skip it
    const lockedNext = new Date(Date.now() + Math.max(15, job.interval_seconds) * 1000).toISOString();
    const { data: locked } = await supabase
      .from("auto_posting_jobs")
      .update({ next_run_at: lockedNext })
      .eq("id", job.id)
      .eq("status", "running")
      .lte("next_run_at", nowIso)
      .select("id")
      .maybeSingle();
    // If the row already had no next_run_at (first run), the lte filter fails; handle that:
    if (!locked && job.next_run_at) continue;
    if (!job.next_run_at) {
      await supabase
        .from("auto_posting_jobs")
        .update({ next_run_at: lockedNext })
        .eq("id", job.id)
        .eq("status", "running");
    }

    const r = await runJobOnce(supabase, job);

    const sent = job.sent_count + (r.ok ? 1 : 0);
    const failed = job.failed_count + (r.ok ? 0 : 1);
    const consecutive = r.ok ? 0 : job.consecutive_failures + 1;
    const totalDone = sent + failed;
    let newStatus = "running";
    let stoppedAt: string | null = null;
    let completedAt: string | null = null;
    let lastError = r.ok ? null : r.error || "Unknown";

    if (totalDone >= job.total_posts) {
      newStatus = "completed";
      completedAt = new Date().toISOString();
    } else if (consecutive >= 3) {
      newStatus = "error";
      stoppedAt = new Date().toISOString();
    }

    const next =
      newStatus === "running"
        ? new Date(Date.now() + job.interval_seconds * 1000).toISOString()
        : null;

    await supabase
      .from("auto_posting_jobs")
      .update({
        sent_count: sent,
        failed_count: failed,
        consecutive_failures: consecutive,
        status: newStatus,
        next_run_at: next,
        last_error: lastError,
        completed_at: completedAt ?? job.completed_at,
        stopped_at: stoppedAt ?? job.stopped_at,
      })
      .eq("id", job.id);

    processed++;
  }

  return { ok: true, processed };
}
