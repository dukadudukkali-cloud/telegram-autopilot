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
  if (!data.ok) {
    const err: any = new Error(data.description || `Telegram ${method} failed`);
    err.telegram = data;
    throw err;
  }
  return data.result;
}

async function getAccount(supabase: SupabaseClient, userId: string, accountId: string) {
  const { data, error } = await supabase
    .from("telegram_configs")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Telegram account not found");
  return data;
}

async function pickAccountForPost(supabase: SupabaseClient, post: any) {
  if (post.telegram_account_id) {
    const { data } = await supabase
      .from("telegram_configs")
      .select("*")
      .eq("id", post.telegram_account_id)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("telegram_configs")
    .select("*")
    .eq("user_id", post.user_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("No active Telegram account configured.");
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
  accountId: string,
): Promise<{ success: boolean; message: string; bot?: any; test_message_id?: number; raw?: any }> {
  let acc: any = null;
  try {
    acc = await getAccount(supabase, userId, accountId);
  } catch (e: any) {
    const msg = String(e?.message ?? e) || "Akun Telegram tidak ditemukan";
    return { success: false, message: msg };
  }

  try {
    if (!acc.bot_token) {
      throw new Error("Bot token belum diisi.");
    }
    if (!acc.channel_id) {
      throw new Error("Channel ID belum diisi.");
    }

    // 1) getMe — validasi token
    let me: any;
    try {
      me = await tg(acc.bot_token, "getMe");
    } catch (e: any) {
      const desc = e?.telegram?.description || e?.message || "Bot token tidak valid";
      throw new Error(`Invalid token: ${desc}`);
    }

    // 2) sendMessage — validasi channel + admin akses
    let sent: any;
    try {
      sent = await tg(acc.bot_token, "sendMessage", {
        chat_id: acc.channel_id,
        text: `✅ <b>Test connection</b>\nBot @${me.username} terhubung ke channel ini.`,
        parse_mode: "HTML",
        disable_notification: true,
      });
    } catch (e: any) {
      const desc: string = e?.telegram?.description || e?.message || "Gagal mengirim pesan tes";
      const lower = desc.toLowerCase();
      let hint = desc;
      if (lower.includes("chat not found")) hint = `Channel not found: ${desc}`;
      else if (lower.includes("forbidden") || lower.includes("not enough rights") || lower.includes("not a member"))
        hint = `Bot bukan admin / Forbidden: ${desc}`;
      else if (lower.includes("bad request")) hint = `Bad request: ${desc}`;
      throw new Error(hint);
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from("telegram_configs")
      .update({
        is_connected: true,
        connection_status: "connected",
        bot_username: me.username ?? "",
        bot_name: acc.bot_name || me.first_name || me.username || "",
        last_tested_at: nowIso,
        last_error: null,
        updated_at: nowIso,
      })
      .eq("id", acc.id);

    await supabase.from("posting_logs").insert({
      user_id: userId,
      telegram_account_id: acc.id,
      action: "test_connection",
      status: "success",
      message: `Connected as @${me.username} → ${acc.channel_name || acc.channel_id}`,
    });

    await logActivity(supabase, userId, "telegram_test_ok", "telegram_account", acc.id, {
      bot: me.username,
      message_id: sent.message_id,
    });

    return {
      success: true,
      message: `Bot @${me.username} berhasil terhubung ke ${acc.channel_name || acc.channel_id}`,
      bot: me,
      test_message_id: sent.message_id,
    };
  } catch (e: any) {
    const errMsg = String(e?.message ?? e) || "Unknown error";
    const raw = e?.telegram ?? null;
    try {
      await supabase
        .from("telegram_configs")
        .update({
          is_connected: false,
          connection_status: "failed",
          last_tested_at: new Date().toISOString(),
          last_error: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", acc.id);
      await supabase.from("posting_logs").insert({
        user_id: userId,
        telegram_account_id: acc.id,
        action: "test_connection",
        status: "failed",
        message: errMsg,
      });
      await logActivity(supabase, userId, "telegram_test_failed", "telegram_account", acc.id, {
        error: errMsg,
        raw,
      });
    } catch (logErr) {
      console.error("Failed to persist telegram test failure", logErr);
    }
    return { success: false, message: errMsg, raw };
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

  const acc = await pickAccountForPost(supabase, post);

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
    chat_id: acc.channel_id,
    parse_mode: "HTML",
  };
  if (inlineKeyboard) body.reply_markup = inlineKeyboard;

  try {
    let result: any;
    if (post.image_url) {
      result = await tg(acc.bot_token, "sendPhoto", {
        ...body,
        photo: post.image_url,
        caption,
      });
    } else {
      result = await tg(acc.bot_token, "sendMessage", {
        ...body,
        text: caption || post.title || "(empty)",
      });
    }
    await supabase
      .from("posts")
      .update({
        status: "posted",
        telegram_message_id: result.message_id,
        telegram_chat_id: String(acc.channel_id),
        telegram_account_id: acc.id,
      })
      .eq("id", postId);

    await supabase.from("posting_logs").insert({
      post_id: postId,
      user_id: userId,
      telegram_account_id: acc.id,
      action: "send",
      status: "success",
      message: `Sent message_id=${result.message_id} via @${acc.bot_username || acc.bot_name} to ${acc.channel_name || acc.channel_id}`,
    });
    await logActivity(supabase, userId, "post_sent", "post", postId, {
      message_id: result.message_id,
      account: acc.id,
    });
    return { ok: true, message_id: result.message_id };
  } catch (e: any) {
    const errMsg = String(e?.message ?? e);
    await supabase.from("posts").update({ status: "failed", telegram_account_id: acc.id }).eq("id", postId);
    await supabase.from("posting_logs").insert({
      post_id: postId,
      user_id: userId,
      telegram_account_id: acc.id,
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
  const acc = await pickAccountForPost(supabase, post);
  try {
    await tg(acc.bot_token, "deleteMessage", {
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
    if (s.telegram_account_id) {
      await supabase
        .from("posts")
        .update({ telegram_account_id: s.telegram_account_id })
        .eq("id", s.post_id);
    }
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
