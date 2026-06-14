import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// --- Listings --------------------------------------------------------------

export const listTemplateTitles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("content_library")
      .select("title, brand, category")
      .eq("user_id", context.userId)
      .eq("type", "image")
      .order("title", { ascending: true });
    if (error) throw error;
    // distinct by title (case-insensitive)
    const seen = new Map<string, { title: string; brand: string | null; category: string | null }>();
    for (const r of data ?? []) {
      const k = (r.title || "").trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.set(k, { title: r.title, brand: r.brand ?? null, category: r.category ?? null });
    }
    return Array.from(seen.values());
  });

export const listBannersByTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { template_title: string }) =>
    z.object({ template_title: z.string().trim().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("content_library")
      .select("id, title, brand, category, media_url, caption, used_count, last_used_at, channel_id")
      .eq("user_id", context.userId)
      .eq("type", "image")
      .ilike("title", data.template_title)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const listChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("telegram_configs")
      .select("id, channel_name, channel_id, is_connected, is_active")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getCaptionForTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { template_title: string }) =>
    z.object({ template_title: z.string().trim().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("caption_templates")
      .select("caption_text, template_name")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .ilike("template_name", data.template_title)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return row ?? null;
  });

export const generateCaptionForTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    template_title: string;
    brand?: string;
    category?: string;
    style?: string;
  }) =>
    z.object({
      template_title: z.string().trim().min(1),
      brand: z.string().optional(),
      category: z.string().optional(),
      style: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateCaption } = await import("./ai.server");
    const theme = [data.brand, data.category, data.style].filter(Boolean).join(" • ");
    const caption = await generateCaption({
      channelName: data.template_title,
      theme: theme || undefined,
      keywords: data.template_title,
    });
    return { caption };
  });

// --- Validation, preview, enqueue, cancel ----------------------------------

const PreviewSchema = z.object({
  template_title: z.string().trim().min(1),
  image_id: z.string().uuid(),
  caption: z.string().trim().min(1, "Caption tidak boleh kosong"),
  caption_source: z.enum(["ai", "database"]),
  channel_ids: z.array(z.string().uuid()).min(1, "Pilih minimal 1 channel"),
});

async function validatePayload(
  supabase: any,
  userId: string,
  input: z.infer<typeof PreviewSchema>,
) {
  // 1) banner
  const { data: banner } = await supabase
    .from("content_library")
    .select("id, title, brand, category, media_url")
    .eq("id", input.image_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!banner) throw new Error("Banner tidak ditemukan untuk template ini");
  if (!banner.media_url) throw new Error("Banner tidak memiliki URL gambar");
  if ((banner.title || "").trim().toLowerCase() !== input.template_title.trim().toLowerCase()) {
    throw new Error("Banner tidak cocok dengan judul/template yang dipilih");
  }

  // 2) caption (DB-mode must come from same template)
  if (input.caption_source === "database") {
    const { data: cap } = await supabase
      .from("caption_templates")
      .select("caption_text")
      .eq("user_id", userId)
      .eq("status", "active")
      .ilike("template_name", input.template_title)
      .limit(1)
      .maybeSingle();
    if (!cap?.caption_text) throw new Error("Caption template tidak ditemukan untuk template ini");
    if (cap.caption_text.trim() !== input.caption.trim()) {
      // Allow user edits but warn — we trust the submitted caption since it must match template title.
      // No-op: accept user-edited caption as long as DB has a template for it.
    }
  }

  // 3) channels
  const { data: channels } = await supabase
    .from("telegram_configs")
    .select("id, channel_name, channel_id, is_connected")
    .eq("user_id", userId)
    .in("id", input.channel_ids);
  if (!channels || channels.length !== input.channel_ids.length) {
    throw new Error("Beberapa channel tidak ditemukan / bukan milik user");
  }
  const noChat = channels.find((c: any) => !c.channel_id);
  if (noChat) throw new Error(`Channel "${noChat.channel_name ?? noChat.id}" belum memiliki chat_id`);

  return { banner, channels };
}

export const previewAutoPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => PreviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { banner, channels } = await validatePayload(context.supabase, context.userId, data);
    return {
      ok: true,
      banner,
      channels,
      caption: data.caption,
      caption_source: data.caption_source,
      template_title: data.template_title,
    };
  });

export const enqueueAutoPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    PreviewSchema.extend({
      scheduled_at: z.string().datetime().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { banner } = await validatePayload(context.supabase, context.userId, data);
    const { data: inserted, error } = await context.supabase
      .from("auto_posting_queue")
      .insert({
        user_id: context.userId,
        template_title: data.template_title,
        brand: banner.brand,
        image_id: banner.id,
        image_url: banner.media_url,
        caption: data.caption,
        caption_source: data.caption_source,
        selected_channel_ids: data.channel_ids,
        scheduled_at: data.scheduled_at ?? null,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return { id: inserted?.id };
  });

export const cancelQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("auto_posting_queue")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if (error) throw error;
    return { ok: true };
  });

export const listQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("auto_posting_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export const listQueueLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { queue_id: string }) => z.object({ queue_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("auto_posting_logs")
      .select("*")
      .eq("queue_id", data.queue_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });
