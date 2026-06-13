import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCaptionTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("caption_templates")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertCaptionTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      channel_id?: string | null;
      channel_name?: string | null;
      template_name: string;
      caption_text: string;
      status?: "active" | "inactive";
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("caption_templates")
        .update({
          channel_id: data.channel_id ?? null,
          channel_name: data.channel_name ?? null,
          template_name: data.template_name,
          caption_text: data.caption_text,
          status: data.status ?? "active",
        })
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true };
    }
    const { error } = await supabase.from("caption_templates").insert({
      user_id: userId,
      channel_id: data.channel_id ?? null,
      channel_name: data.channel_name ?? null,
      template_name: data.template_name,
      caption_text: data.caption_text,
      status: data.status ?? "active",
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteCaptionTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase.from("caption_templates").delete().eq("id", data.id);
    return { ok: true };
  });
