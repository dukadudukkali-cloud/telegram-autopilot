// Server-only Telegram logic. The .server.ts extension blocks client imports.
import type { SupabaseClient } from "@supabase/supabase-js";

const TG = "https://api.telegram.org";

async function tg(token: string, method: string, body?: unknown) {
  const res = await fetch(`${TG}/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

async function getUserConfig(supabase: SupabaseClient, userId: string, configId?: string) {
  let q = supabase.from("telegram_configs").select("*").eq("user_id", userId);
  if (configId) q = q.eq("id", configId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No Telegram config found. Please set up your bot first.");
  return data;
}

async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  await supabase.from("activity_logs").insert({
    user_id: userId,
    action,
    entity: entity ?? null,
    entity_id: entityId ?? null,
    metadata: metadata ?? {},
  });
}

export async function testTelegramConnectionSrv(
  supabase: SupabaseClient,
  userId: string,
  configId: string,
) {
  const cfg = await getUserConfig(supabase, userId, configId);
  try {
    const me = await tg(cfg.bot_token, "getMe");
    const chat = await tg(cfg.bot_token, "getChat", { chat_id: cfg.channel_id });
    await supabase
      .from("telegram_configs")
      .update({
        is_connected: true,
        bot_username: me.username ?? "",
        channel_name: chat.title ?? cfg.channel_name ?? "",
        last_tested_at: new Date().toISOString(),
      })
      .eq("id", cfg.id);
    await logActivity(supabase, userId, "telegram_test", "telegram_config", cfg.id, {
      bot: me.username,
      channel: chat.title,
    });
    return { ok: true, bot: me, chat };
  } catch (e: any) {
    await supabase
      .from("telegram_configs")
      .update({ is_connected: false, last_tested_at: new Date().toISOString() })
      .eq("id", cfg.id);
    await logActivity(supabase, userId, "telegram_test_failed", "telegram_config", cfg.id, {
      error: String(e?.message ?? e),
    });
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function sendPostToTelegramSrv(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
) {
  const { data: post, error: pErr } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!post) throw new Error("Post not found");

  const cfg = await getUserConfig(supabase, post.user_id);

  const { data: btns } = await supabase
    .from("post_buttons")
    .select("*")
    .eq("post_id", postId)
    .order("sort_order", { ascending: true });

  const inlineKeyboard =
    btns && btns.length
      ? {
          inline_keyboard: btns.map((b) => [{ text: b.button_text, url: b.button_url }]),
        }
      : undefined;

  const caption = post.caption || "";
  const body: Record<string, unknown> = {
    chat_id: cfg.channel_id,
    parse_mode: "HTML",
  };
  if (inlineKeyboard) body.reply_markup = inlineKeyboard;

  try {
    let result: any;
    if (post.image_url) {
      result = await tg(cfg.bot_token, "sendPhoto", {
        ...body,
        photo: post.image_url,
        caption,
      });
    } else {
      result = await tg(cfg.bot_token, "sendMessage", {
        ...body,
        text: caption || post.title || "(empty)",
      });
    }
    await supabase
      .from("posts")
      .update({
        status: "posted",
        telegram_message_id: result.message_id,
        telegram_chat_id: String(cfg.channel_id),
      })
      .eq("id", postId);

    await supabase.from("posting_logs").insert({
      post_id: postId,
      user_id: userId,
      action: "send",
      status: "success",
      message: `Sent message_id=${result.message_id} to ${cfg.channel_name || cfg.channel_id}`,
    });
    await logActivity(supabase, userId, "post_sent", "post", postId, {
      message_id: result.message_id,
    });
    return { ok: true, message_id: result.message_id };
  } catch (e: any) {
    const errMsg = String(e?.message ?? e);
    await supabase.from("posts").update({ status: "failed" }).eq("id", postId);
    await supabase.from("posting_logs").insert({
      post_id: postId,
      user_id: userId,
      action: "send",
      status: "failed",
      message: errMsg,
    });
    await logActivity(supabase, userId, "post_send_failed", "post", postId, { error: errMsg });
    return { ok: false, error: errMsg };
  }
}

export async function deleteTelegramMessageSrv(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
) {
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!post) throw new Error("Post not found");
  if (!post.telegram_message_id || !post.telegram_chat_id) {
    return { ok: false, error: "Post is not posted to Telegram yet." };
  }
  const cfg = await getUserConfig(supabase, post.user_id);
  try {
    await tg(cfg.bot_token, "deleteMessage", {
      chat_id: post.telegram_chat_id,
      message_id: post.telegram_message_id,
    });
    await logActivity(supabase, userId, "telegram_message_deleted", "post", postId);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function runDueSchedulesSrv(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("schedules")
    .select("*")
    .lte("scheduled_at", now)
    .eq("status", "pending");
  if (error) throw error;
  let processed = 0;
  for (const s of due || []) {
    const r = await sendPostToTelegramSrv(supabase, s.user_id, s.post_id);
    let nextStatus: string = r.ok ? "success" : "failed";
    let nextScheduledAt: string | null = null;
    if (r.ok && s.repeat_type && s.repeat_type !== "none") {
      const d = new Date(s.scheduled_at);
      if (s.repeat_type === "daily") d.setDate(d.getDate() + 1);
      if (s.repeat_type === "weekly") d.setDate(d.getDate() + 7);
      nextScheduledAt = d.toISOString();
      nextStatus = "pending";
    }
    await supabase
      .from("schedules")
      .update({
        status: nextStatus,
        last_run_at: now,
        ...(nextScheduledAt ? { scheduled_at: nextScheduledAt } : {}),
      })
      .eq("id", s.id);
    processed++;
  }
  await logActivity(supabase, userId, "scheduler_run", undefined, undefined, { processed });
  return { ok: true, processed };
}
