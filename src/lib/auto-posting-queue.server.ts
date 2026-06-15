// Server-only worker for auto_posting_queue (multi-channel, template-locked).
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPostToTelegramSrv } from "./telegram.server";

type QueueRow = {
  id: string;
  user_id: string;
  template_title: string;
  brand: string | null;
  image_id: string | null;
  image_url: string;
  caption: string;
  caption_source: "ai" | "database";
  selected_channel_ids: string[];
  scheduled_at: string | null;
  status: string;
};

async function processQueueRow(supabase: SupabaseClient, row: QueueRow) {
  // Validate channels belong to user and are usable
  const { data: channels } = await supabase
    .from("telegram_configs")
    .select("id, channel_id, channel_name, bot_token")
    .eq("user_id", row.user_id)
    .in("id", row.selected_channel_ids);

  if (!channels || channels.length === 0) {
    await supabase
      .from("auto_posting_queue")
      .update({ status: "failed", error_message: "Tidak ada channel valid yang dipilih" })
      .eq("id", row.id);
    return;
  }

  // Bulk-resolve mode: template_title starts with "__BULK__:mode:strategy".
  // Resolve real image+caption per channel at processing time.
  let bulkMode: string | null = null;
  let bulkStrategy: string | null = null;
  if (row.template_title.startsWith("__BULK__:")) {
    const [, mode, strategy] = row.template_title.split(":");
    bulkMode = mode;
    bulkStrategy = strategy ?? "random";
  }

  // Existing logs (idempotency on retry)
  const { data: existingLogs } = await supabase
    .from("auto_posting_logs")
    .select("channel_id, status")
    .eq("queue_id", row.id);
  const alreadyDone = new Set((existingLogs ?? []).filter((l) => l.status === "sent").map((l) => l.channel_id));

  let okCount = 0;
  let failCount = 0;

  for (const ch of channels) {
    if (alreadyDone.has(ch.id)) {
      okCount++;
      continue;
    }
    let postId: string | null = null;
    let r: { ok: boolean; error?: string; message_id?: number } = { ok: false, error: "unknown" };

    try {
      const { data: post, error: pErr } = await supabase
        .from("posts")
        .insert({
          user_id: row.user_id,
          title: `Auto: ${row.template_title}`,
          caption: row.caption,
          image_url: row.image_url,
          media: [{ type: "image", url: row.image_url }],
          telegram_account_id: ch.id,
          status: "queued",
          platform: "telegram",
        })
        .select("id")
        .maybeSingle();
      if (pErr || !post) throw new Error(pErr?.message || "Gagal membuat post sementara");
      postId = post.id;
      r = await sendPostToTelegramSrv(supabase, row.user_id, post.id);
    } catch (e: any) {
      r = { ok: false, error: String(e?.message ?? e) };
    }

    if (r.ok) okCount++;
    else failCount++;

    // Upsert log (unique on queue_id+channel_id)
    await supabase.from("auto_posting_logs").upsert(
      {
        queue_id: row.id,
        user_id: row.user_id,
        channel_id: ch.id,
        channel_name: ch.channel_name,
        telegram_chat_id: ch.channel_id,
        post_id: postId,
        image_url: row.image_url,
        caption_text: row.caption,
        telegram_message_id: r.ok ? r.message_id ?? null : null,
        status: r.ok ? "sent" : "failed",
        error_message: r.ok ? null : (r.error ?? "Unknown error"),
        sent_at: r.ok ? new Date().toISOString() : null,
      },
      { onConflict: "queue_id,channel_id" },
    );
  }

  // Account for channels that were requested but missing in DB lookup
  const missingChannels = row.selected_channel_ids.filter(
    (id) => !channels.find((c) => c.id === id),
  );
  for (const missingId of missingChannels) {
    failCount++;
    await supabase.from("auto_posting_logs").upsert(
      {
        queue_id: row.id,
        user_id: row.user_id,
        channel_id: missingId,
        status: "failed",
        error_message: "Channel tidak ditemukan / tidak dimiliki user",
        image_url: row.image_url,
        caption_text: row.caption,
      },
      { onConflict: "queue_id,channel_id" },
    );
  }

  const finalStatus =
    failCount === 0 ? "success" : okCount === 0 ? "failed" : "partial";

  await supabase
    .from("auto_posting_queue")
    .update({ status: finalStatus, error_message: failCount > 0 ? `${failCount} channel gagal` : null })
    .eq("id", row.id);
}

export async function runAutoPostingQueueTick(supabase: SupabaseClient): Promise<{ processed: number }> {
  const nowIso = new Date().toISOString();
  // Atomic claim: only rows whose schedule has come due.
  const { data: claimed } = await supabase
    .from("auto_posting_queue")
    .update({ status: "processing", processing_started_at: nowIso })
    .eq("status", "pending")
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .select("*")
    .limit(10);

  if (!claimed || claimed.length === 0) return { processed: 0 };

  for (const row of claimed as QueueRow[]) {
    try {
      await processQueueRow(supabase, row);
    } catch (e: any) {
      await supabase
        .from("auto_posting_queue")
        .update({ status: "failed", error_message: String(e?.message ?? e) })
        .eq("id", row.id);
    }
  }

  return { processed: claimed.length };
}
