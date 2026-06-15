// Server-only helpers for bulk auto-posting.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateCaption,
  generateImageBase64,
  generateImagePrompt,
} from "./ai.server";

export type Mode =
  | "ai_full"
  | "db_image_db_caption"
  | "db_image_ai_caption"
  | "ai_image_db_caption";

export type DbStrategy = "by_date" | "random";

export type ChannelCtx = {
  id: string;
  channel_name: string | null;
  channel_id: string | null;
};

export type ResolvedPost = {
  template_title: string;
  brand: string | null;
  image_url: string;
  image_id: string | null;
  caption: string;
  caption_source: "ai" | "database";
};

/** Pick one image row from content_library for this user, matching rules. */
async function pickImage(
  supabase: SupabaseClient,
  userId: string,
  strategy: DbStrategy,
  used: Set<string>,
): Promise<{ id: string; title: string; brand: string | null; media_url: string } | null> {
  let q = supabase
    .from("content_library")
    .select("id, title, brand, media_url, content_day, content_month, content_year")
    .eq("user_id", userId)
    .eq("type", "image")
    .not("media_url", "is", null);

  if (strategy === "by_date") {
    const now = new Date();
    q = q
      .eq("content_day", now.getDate())
      .eq("content_month", now.getMonth() + 1)
      .eq("content_year", now.getFullYear());
  }
  const { data } = await q.limit(200);
  let pool = (data ?? []).filter((r: any) => !used.has(r.id));
  if (pool.length === 0 && used.size > 0) pool = data ?? []; // allow reuse
  if (pool.length === 0) return null;
  const pick = strategy === "random"
    ? pool[Math.floor(Math.random() * pool.length)]
    : pool[0];
  return pick as any;
}

/** Find matching caption by title + brand (+ date if by_date). */
async function pickCaption(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  brand: string | null,
  strategy: DbStrategy,
): Promise<string | null> {
  let q = supabase
    .from("caption_templates")
    .select("caption_text, hashtag, content_day, content_month, content_year, brand")
    .eq("user_id", userId)
    .eq("status", "active")
    .ilike("template_name", title);
  if (brand) q = q.eq("brand", brand);
  if (strategy === "by_date") {
    const now = new Date();
    q = q
      .eq("content_day", now.getDate())
      .eq("content_month", now.getMonth() + 1)
      .eq("content_year", now.getFullYear());
  }
  const { data } = await q.limit(50);
  if (!data || data.length === 0) return null;
  const pick = strategy === "random" ? data[Math.floor(Math.random() * data.length)] : data[0];
  const tail = pick.hashtag ? `\n\n${pick.hashtag}` : "";
  return `${pick.caption_text}${tail}`;
}

/** Pick a caption template title to seed AI-full mode. */
async function pickAnyTemplateTitle(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ title: string; brand: string | null } | null> {
  const { data } = await supabase
    .from("caption_templates")
    .select("template_name, brand")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(50);
  if (!data || data.length === 0) {
    // fallback to library
    const { data: lib } = await supabase
      .from("content_library")
      .select("title, brand")
      .eq("user_id", userId)
      .eq("type", "image")
      .limit(50);
    if (!lib || lib.length === 0) return null;
    const r = lib[Math.floor(Math.random() * lib.length)];
    return { title: r.title, brand: r.brand };
  }
  const r = data[Math.floor(Math.random() * data.length)];
  return { title: r.template_name, brand: r.brand };
}

/** Upload an AI-generated base64 PNG to the content-library bucket; return public URL. */
async function uploadAiImage(userId: string, b64: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${userId}/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await supabaseAdmin.storage
    .from("content-library")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Upload AI image gagal: ${error.message}`);
  const { data } = supabaseAdmin.storage.from("content-library").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Resolve a single post payload according to mode + strategy.
 * Throws on unrecoverable mismatch so caller can mark queue row as failed.
 */
export async function resolvePost(
  supabase: SupabaseClient,
  userId: string,
  mode: Mode,
  strategy: DbStrategy,
  channelName: string | null,
  usedImageIds: Set<string>,
): Promise<ResolvedPost> {
  if (mode === "ai_full") {
    const seed = await pickAnyTemplateTitle(supabase, userId);
    const title = seed?.title ?? channelName ?? "Konten";
    const brand = seed?.brand ?? null;
    const prompt = await generateImagePrompt(channelName ?? undefined, title);
    const b64 = await generateImageBase64(prompt);
    const url = await uploadAiImage(userId, b64);
    const caption = await generateCaption({
      channelName: channelName ?? undefined,
      theme: brand ?? title,
      keywords: title,
    });
    return {
      template_title: title,
      brand,
      image_url: url,
      image_id: null,
      caption,
      caption_source: "ai",
    };
  }

  if (mode === "db_image_db_caption") {
    const img = await pickImage(supabase, userId, strategy, usedImageIds);
    if (!img) throw new Error("Tidak ada gambar yang cocok di Library Konten");
    usedImageIds.add(img.id);
    const cap = await pickCaption(supabase, userId, img.title, img.brand, strategy);
    if (!cap) throw new Error(`Caption template tidak ditemukan untuk "${img.title}"`);
    return {
      template_title: img.title,
      brand: img.brand,
      image_url: img.media_url,
      image_id: img.id,
      caption: cap,
      caption_source: "database",
    };
  }

  if (mode === "db_image_ai_caption") {
    const img = await pickImage(supabase, userId, strategy, usedImageIds);
    if (!img) throw new Error("Tidak ada gambar yang cocok di Library Konten");
    usedImageIds.add(img.id);
    const caption = await generateCaption({
      channelName: channelName ?? undefined,
      theme: [img.brand, img.title].filter(Boolean).join(" • "),
      keywords: img.title,
    });
    return {
      template_title: img.title,
      brand: img.brand,
      image_url: img.media_url,
      image_id: img.id,
      caption,
      caption_source: "ai",
    };
  }

  // ai_image_db_caption
  const seed = await pickAnyTemplateTitle(supabase, userId);
  if (!seed) throw new Error("Tidak ada template caption untuk dipakai");
  const cap = await pickCaption(supabase, userId, seed.title, seed.brand, strategy);
  if (!cap) throw new Error(`Caption template "${seed.title}" tidak ditemukan`);
  const prompt = await generateImagePrompt(channelName ?? undefined, `${seed.title} ${seed.brand ?? ""}`);
  const b64 = await generateImageBase64(prompt);
  const url = await uploadAiImage(userId, b64);
  return {
    template_title: seed.title,
    brand: seed.brand,
    image_url: url,
    image_id: null,
    caption: cap,
    caption_source: "database",
  };
}

/**
 * Build a schedule grid: each channel gets its own timeline starting at `startAt`,
 * spaced `spacingMin` minutes apart for `count` posts.
 * Returns Date[] of length count (one timeline) — caller iterates per channel.
 */
export function buildSchedule(startAt: Date, count: number, spacingMin: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(startAt.getTime() + i * spacingMin * 60_000));
  }
  return out;
}
