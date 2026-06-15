import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------------- Stats ----------------

export const getAutoPostingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [queueRes, logsSent, logsFailed] = await Promise.all([
      supabase.from("auto_posting_queue").select("status", { count: "exact" }).eq("user_id", userId),
      supabase
        .from("auto_posting_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "sent"),
      supabase
        .from("auto_posting_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "failed"),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of queueRes.data ?? []) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    const total = queueRes.count ?? 0;
    return {
      total,
      scheduled: byStatus["pending"] ?? 0,
      processing: byStatus["processing"] ?? 0,
      draft: byStatus["draft"] ?? 0,
      sent: logsSent.count ?? 0,
      failed: logsFailed.count ?? 0,
    };
  });

// ---------------- Channels ----------------

export const listAllChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("telegram_configs")
      .select("id, channel_name, channel_id, is_connected, is_active, connection_status, last_error")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getSelectedChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_settings")
      .select("selected_channel_ids")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (data?.selected_channel_ids as string[] | null) ?? [];
  });

export const saveSelectedChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("app_settings")
      .update({ selected_channel_ids: data.ids })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Bulk enqueue ----------------

const BulkSchema = z.object({
  mode: z.enum(["ai_full", "db_image_db_caption", "db_image_ai_caption", "ai_image_db_caption"]),
  db_strategy: z.enum(["by_date", "random"]).default("random"),
  channel_ids: z.array(z.string().uuid()).min(1, "Pilih minimal 1 channel"),
  count_per_channel: z.number().int().min(1).max(50),
  schedule_mode: z.enum(["now", "scheduled"]),
  start_at: z.string().datetime().optional().nullable(),
  auto_generate: z.boolean().default(true),
  spacing_min: z.number().int().min(1).max(720).default(30),
});

export const previewBulkAutoPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => BulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: channels } = await supabase
      .from("telegram_configs")
      .select("id, channel_name, channel_id")
      .eq("user_id", userId)
      .in("id", data.channel_ids);

    if (!channels || channels.length !== data.channel_ids.length) {
      throw new Error("Beberapa channel tidak ditemukan");
    }
    const noChat = channels.find((c: any) => !c.channel_id);
    if (noChat) throw new Error(`Channel "${noChat.channel_name}" belum memiliki chat_id`);

    // Try to resolve ONE sample post (without persisting / without calling AI for image to save credits).
    let sample:
      | { template_title: string; brand: string | null; image_url: string | null; caption: string }
      | null = null;
    if (data.mode === "db_image_db_caption" || data.mode === "db_image_ai_caption") {
      const { resolvePost } = await import("./auto-posting-bulk.server");
      try {
        // For preview we only want a peek — try resolvePost but catch image gen failures.
        if (data.mode === "db_image_db_caption") {
          const r = await resolvePost(
            supabase,
            userId,
            "db_image_db_caption",
            data.db_strategy,
            channels[0].channel_name,
            new Set(),
          );
          sample = {
            template_title: r.template_title,
            brand: r.brand,
            image_url: r.image_url,
            caption: r.caption,
          };
        } else {
          // db image + ai caption — peek at image only, caption AI shown as placeholder
          const { data: rows } = await supabase
            .from("content_library")
            .select("id, title, brand, media_url")
            .eq("user_id", userId)
            .eq("type", "image")
            .not("media_url", "is", null)
            .limit(1);
          if (rows && rows.length > 0) {
            sample = {
              template_title: rows[0].title,
              brand: rows[0].brand,
              image_url: rows[0].media_url,
              caption: "✨ Caption akan dibuat oleh AI saat posting.",
            };
          }
        }
      } catch (e: any) {
        sample = null;
      }
    } else if (data.mode === "ai_image_db_caption") {
      const { data: rows } = await supabase
        .from("caption_templates")
        .select("template_name, brand, caption_text")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1);
      if (rows && rows.length > 0) {
        sample = {
          template_title: rows[0].template_name,
          brand: rows[0].brand,
          image_url: null,
          caption: rows[0].caption_text,
        };
      }
    } else {
      sample = {
        template_title: "AI Menyeluruh",
        brand: null,
        image_url: null,
        caption: "✨ Caption + gambar akan dibuat AI saat posting.",
      };
    }

    return {
      channels: channels.map((c: any) => ({ id: c.id, name: c.channel_name })),
      total_posts: data.count_per_channel * channels.length,
      per_channel: data.count_per_channel,
      sample,
    };
  });

export const enqueueBulkAutoPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => BulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: channels } = await supabase
      .from("telegram_configs")
      .select("id, channel_name, channel_id")
      .eq("user_id", userId)
      .in("id", data.channel_ids);
    if (!channels || channels.length === 0) throw new Error("Channel tidak valid");

    const { buildSchedule } = await import("./auto-posting-bulk.server");
    const start =
      data.schedule_mode === "now"
        ? new Date()
        : data.start_at
          ? new Date(data.start_at)
          : new Date();

    const slots = data.auto_generate
      ? buildSchedule(start, data.count_per_channel, data.spacing_min)
      : Array.from({ length: data.count_per_channel }, () => start);

    // Build queue rows: one per (channel × slot). image_url + caption are placeholders;
    // the worker will resolve real content via resolvePost when the row is claimed.
    const rows: any[] = [];
    for (const ch of channels as any[]) {
      for (let i = 0; i < slots.length; i++) {
        rows.push({
          user_id: userId,
          template_title: `__BULK__:${data.mode}:${data.db_strategy}`,
          brand: null,
          image_id: null,
          image_url: "pending://resolve-on-worker",
          caption: "(pending)",
          caption_source: data.mode === "db_image_db_caption" || data.mode === "ai_image_db_caption" ? "database" : "ai",
          selected_channel_ids: [ch.id],
          scheduled_at:
            data.schedule_mode === "now" && i === 0
              ? null
              : slots[i].toISOString(),
          status: "pending",
        });
      }
    }

    const { error, data: inserted } = await supabase
      .from("auto_posting_queue")
      .insert(rows)
      .select("id");
    if (error) throw error;
    return { ok: true, enqueued: inserted?.length ?? 0 };
  });

// ---------------- Scheduled table ----------------

export const listScheduledPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("auto_posting_queue")
      .select("id, template_title, brand, image_url, caption, caption_source, selected_channel_ids, scheduled_at, status, error_message, created_at")
      .eq("user_id", context.userId)
      .order("scheduled_at", { ascending: true, nullsFirst: true })
      .limit(100);
    if (error) throw error;

    // map channel ids → names
    const allIds = Array.from(new Set((data ?? []).flatMap((r: any) => r.selected_channel_ids ?? [])));
    const nameMap: Record<string, string> = {};
    if (allIds.length > 0) {
      const { data: chs } = await context.supabase
        .from("telegram_configs")
        .select("id, channel_name")
        .in("id", allIds);
      for (const c of chs ?? []) nameMap[c.id] = c.channel_name ?? c.id;
    }
    return (data ?? []).map((r: any) => ({
      ...r,
      channel_names: (r.selected_channel_ids ?? []).map((id: string) => nameMap[id] ?? id),
    }));
  });

export const cancelScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("auto_posting_queue")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["pending"]);
    if (error) throw error;
    return { ok: true };
  });

export const retryFailedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("auto_posting_queue")
      .update({ status: "pending", error_message: null, scheduled_at: null })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["failed", "partial", "cancelled"]);
    if (error) throw error;
    return { ok: true };
  });

export const runScheduledNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("auto_posting_queue")
      .update({ scheduled_at: null, status: "pending" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
