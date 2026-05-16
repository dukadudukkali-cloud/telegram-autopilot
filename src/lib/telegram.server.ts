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
    err.status = res.status;
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
    return { success: false, message: String(e?.message ?? e) || "Akun Telegram tidak ditemukan" };
  }

  try {
    if (!acc.bot_token) throw new Error("Bot token belum diisi.");
    if (!acc.channel_id) throw new Error("Channel ID belum diisi.");

    let me: any;
    try {
      me = await tg(acc.bot_token, "getMe");
    } catch (e: any) {
      throw new Error(`Invalid token: ${e?.telegram?.description || e?.message || "unknown"}`);
    }

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
      await logActivity(supabase, userId, "telegram_test_failed", "telegram_account", acc.id, { error: errMsg, raw });
    } catch (logErr) {
      console.error("Failed to persist telegram test failure", logErr);
    }
    return { success: false, message: errMsg, raw };
  }
}

function normalizeUrl(u: string): string {
  const t = (u || "").trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

async function loadInlineKeyboardForAccount(supabase: SupabaseClient, accountId: string) {
  const { data: btns } = await supabase
    .from("telegram_inline_buttons")
    .select("button_text, button_url, is_active, sort_order")
    .eq("telegram_account_id", accountId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (!btns || btns.length === 0) return undefined;
  return {
    inline_keyboard: btns.map((b) => [{ text: b.button_text, url: normalizeUrl(b.button_url) }]),
  };
}

export async function sendPostToTelegramSrv(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
) {
  console.log("[telegram] sendPost start", { postId });
  const { data: post, error: pErr } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!post) throw new Error("Post not found");

  const acc = await pickAccountForPost(supabase, post);
  if (!acc.bot_token) {
    const err = "Bot token belum diisi";
    await supabase.from("posts").update({ status: "failed", error_message: err, telegram_account_id: acc.id }).eq("id", postId);
    return { ok: false, error: err };
  }
  if (!acc.channel_id) {
    const err = "Channel ID belum diisi";
    await supabase.from("posts").update({ status: "failed", error_message: err, telegram_account_id: acc.id }).eq("id", postId);
    return { ok: false, error: err };
  }

  const inlineKeyboard = await loadInlineKeyboardForAccount(supabase, acc.id);

  const caption = post.caption || "";
  const mediaArr: Array<{ type: "image" | "video"; url: string }> = Array.isArray(post.media)
    ? post.media.filter((m: any) => m && m.url && (m.type === "image" || m.type === "video"))
    : [];
  const hasMedia = mediaArr.length > 0 || !!post.image_url;

  if (!caption && !post.title && !hasMedia) {
    const err = "Konten kosong (judul/caption/media wajib ada)";
    await supabase.from("posts").update({ status: "failed", error_message: err, telegram_account_id: acc.id }).eq("id", postId);
    return { ok: false, error: err };
  }

  try {
    let result: any;
    const base = { chat_id: acc.channel_id };

    if (mediaArr.length > 1) {
      // sendMediaGroup — up to 10. Caption on the first item.
      const group = mediaArr.slice(0, 10).map((m, i) => ({
        type: m.type === "image" ? "photo" : "video",
        media: m.url,
        ...(i === 0 && caption ? { caption, parse_mode: "HTML" } : {}),
      }));
      const sent = await tg(acc.bot_token, "sendMediaGroup", { ...base, media: group });
      result = Array.isArray(sent) ? sent[0] : sent;
      // sendMediaGroup does NOT support reply_markup. Send a follow-up text with buttons if needed.
      if (inlineKeyboard) {
        await tg(acc.bot_token, "sendMessage", {
          ...base,
          text: "👇",
          reply_markup: inlineKeyboard,
          disable_notification: true,
        }).catch(() => null);
      }
    } else {
      const single = mediaArr[0] || (post.image_url ? { type: "image" as const, url: post.image_url } : null);
      const body: Record<string, unknown> = { ...base, parse_mode: "HTML" };
      if (inlineKeyboard) body.reply_markup = inlineKeyboard;
      if (single?.type === "image") {
        result = await tg(acc.bot_token, "sendPhoto", { ...body, photo: single.url, caption });
      } else if (single?.type === "video") {
        result = await tg(acc.bot_token, "sendVideo", { ...body, video: single.url, caption, supports_streaming: true });
      } else {
        result = await tg(acc.bot_token, "sendMessage", { ...body, text: caption || post.title || "(empty)" });
      }
    }
    const nowIso = new Date().toISOString();
    await supabase
      .from("posts")
      .update({
        status: "sent",
        telegram_message_id: result.message_id,
        telegram_chat_id: String(acc.channel_id),
        telegram_account_id: acc.id,
        sent_at: nowIso,
        error_message: null,
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
    await logActivity(supabase, userId, "post_sent", "post", postId, { message_id: result.message_id, account: acc.id });
    console.log("[telegram] sendPost success", { postId, message_id: result.message_id });
    return { ok: true, message_id: result.message_id };
  } catch (e: any) {
    const errMsg: string = e?.telegram?.description || e?.message || String(e);
    const status: number | undefined = e?.status;
    await supabase
      .from("posts")
      .update({ status: "failed", error_message: errMsg, telegram_account_id: acc.id })
      .eq("id", postId);
    await supabase.from("posting_logs").insert({
      post_id: postId,
      user_id: userId,
      telegram_account_id: acc.id,
      action: "send",
      status: "failed",
      message: errMsg,
    });
    await logActivity(supabase, userId, "post_send_failed", "post", postId, { error: errMsg, status });
    console.error("[telegram] sendPost failed", { postId, errMsg, status });
    const retryable = !status || status >= 500 || status === 429 || /timeout|network|fetch/i.test(errMsg);
    return { ok: false, error: errMsg, retryable };
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

const STATUS_SCHEDULED = "scheduled";
const STATUS_QUEUED = "queued";
const STATUS_PROCESSING = "processing";
const STATUS_SENT = "sent";
const STATUS_FAILED = "failed";

/**
 * Run scheduler for one user (used by manual trigger from UI).
 * Actual production scheduling runs via /api/public/hooks/run-schedules with admin client.
 */
export async function runDueSchedulesSrv(supabase: SupabaseClient, userId: string) {
  return runSchedulerCore(supabase, { userId });
}

/**
 * Core scheduler:
 * 1. Promote due `scheduled` (or legacy `pending`) into `queued`, spaced 60s apart per user.
 * 2. Pick one ready `queued` per user, lock to `processing`, send, then mark sent/failed.
 * 3. Retry once on transient failure.
 */
export async function runSchedulerCore(
  supabase: SupabaseClient,
  opts: { userId?: string } = {},
): Promise<{ ok: boolean; processed: number; queued: number }> {
  const nowIso = new Date().toISOString();
  console.log("[scheduler] tick", { now: nowIso, scope: opts.userId ?? "ALL" });

  // ---------- Step A: promote due schedules into the queue ----------
  let dueQuery = supabase
    .from("schedules")
    .select("id, user_id, scheduled_at, post_id, telegram_account_id")
    .lte("scheduled_at", nowIso)
    .in("status", [STATUS_SCHEDULED, "pending"]);
  if (opts.userId) dueQuery = dueQuery.eq("user_id", opts.userId);
  const { data: due, error: dueErr } = await dueQuery;
  if (dueErr) {
    console.error("[scheduler] due query error", dueErr);
    throw dueErr;
  }

  let queuedCount = 0;
  if (due && due.length) {
    // group per user, space available_at by 60s starting from latest known busy time
    const byUser = new Map<string, typeof due>();
    for (const s of due) {
      const arr = byUser.get(s.user_id) || [];
      arr.push(s);
      byUser.set(s.user_id, arr);
    }
    for (const [uid, list] of byUser) {
      // find latest available_at currently queued/processing for this user
      const { data: lastBusy } = await supabase
        .from("schedules")
        .select("available_at")
        .eq("user_id", uid)
        .in("status", [STATUS_QUEUED, STATUS_PROCESSING])
        .order("available_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let cursor = Date.now();
      if (lastBusy?.available_at) {
        cursor = Math.max(cursor, new Date(lastBusy.available_at).getTime() + 60_000);
      }
      list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      for (const s of list) {
        const availIso = new Date(cursor).toISOString();
        await supabase
          .from("schedules")
          .update({ status: STATUS_QUEUED, available_at: availIso })
          .eq("id", s.id)
          .in("status", [STATUS_SCHEDULED, "pending"]);
        cursor += 60_000;
        queuedCount++;
      }
    }
    console.log("[scheduler] queued", queuedCount);
  }

  // ---------- Step B: pick & process ready queued items ----------
  let readyQuery = supabase
    .from("schedules")
    .select("*")
    .eq("status", STATUS_QUEUED)
    .lte("available_at", new Date().toISOString())
    .order("available_at", { ascending: true })
    .limit(20);
  if (opts.userId) readyQuery = readyQuery.eq("user_id", opts.userId);
  const { data: ready, error: readyErr } = await readyQuery;
  if (readyErr) {
    console.error("[scheduler] ready query error", readyErr);
    throw readyErr;
  }

  let processed = 0;
  for (const s of ready || []) {
    // Atomic lock: flip queued -> processing, only succeeds for the worker that wins
    const { data: locked } = await supabase
      .from("schedules")
      .update({ status: STATUS_PROCESSING, processing_started_at: new Date().toISOString() })
      .eq("id", s.id)
      .eq("status", STATUS_QUEUED)
      .select()
      .maybeSingle();
    if (!locked) {
      console.log("[scheduler] skip (lock missed)", s.id);
      continue;
    }
    console.log("[scheduler] processing", { id: s.id, post_id: s.post_id });

    if (s.telegram_account_id) {
      await supabase.from("posts").update({ telegram_account_id: s.telegram_account_id }).eq("id", s.post_id);
    }

    const r = await sendPostToTelegramSrv(supabase, s.user_id, s.post_id);
    const nowIso2 = new Date().toISOString();

    if (r.ok) {
      // schedule next occurrence if recurring
      let nextScheduledAt: string | null = null;
      if (s.repeat_type && s.repeat_type !== "none") {
        const d = new Date(s.scheduled_at);
        if (s.repeat_type === "daily") d.setDate(d.getDate() + 1);
        if (s.repeat_type === "weekly") d.setDate(d.getDate() + 7);
        nextScheduledAt = d.toISOString();
      }
      await supabase
        .from("schedules")
        .update({
          status: STATUS_SENT,
          last_run_at: nowIso2,
          sent_at: nowIso2,
        })
        .eq("id", s.id);
      if (nextScheduledAt) {
        await supabase.from("schedules").insert({
          post_id: s.post_id,
          user_id: s.user_id,
          telegram_account_id: s.telegram_account_id,
          scheduled_at: nextScheduledAt,
          repeat_type: s.repeat_type,
          status: STATUS_SCHEDULED,
        });
      }
      console.log("[scheduler] sent", s.id);
    } else {
      const retryCount = s.retry_count ?? 0;
      const canRetry = (r as any).retryable && retryCount < 1;
      if (canRetry) {
        const nextAvail = new Date(Date.now() + 60_000).toISOString();
        await supabase
          .from("schedules")
          .update({
            status: STATUS_QUEUED,
            available_at: nextAvail,
            retry_count: retryCount + 1,
            last_run_at: nowIso2,
          })
          .eq("id", s.id);
        console.log("[scheduler] retry scheduled", { id: s.id, in: nextAvail });
      } else {
        await supabase
          .from("schedules")
          .update({ status: STATUS_FAILED, last_run_at: nowIso2 })
          .eq("id", s.id);
        console.log("[scheduler] failed", { id: s.id, error: r.error });
      }
    }
    processed++;
  }

  if (opts.userId) {
    await logActivity(supabase, opts.userId, "scheduler_run", undefined, undefined, {
      processed,
      queued: queuedCount,
    });
  }
  return { ok: true, processed, queued: queuedCount };
}
