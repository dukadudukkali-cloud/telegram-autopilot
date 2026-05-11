// Server-only admin operations using service role key.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin only");
}

export async function adminCreateUserSrv(
  supabase: SupabaseClient,
  callerId: string,
  input: {
    email: string;
    password: string;
    name: string;
    role: "admin" | "operator";
    status: "active" | "inactive";
  },
) {
  await ensureAdmin(supabase, callerId);

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (error) throw error;
  const newUserId = created.user!.id;

  // Trigger handle_new_user already inserts profile + default operator role + settings.
  // Apply requested role (if admin) and status.
  if (input.role === "admin") {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: newUserId, role: "admin" },
      { onConflict: "user_id,role" },
    );
  }
  await supabaseAdmin
    .from("users_profile")
    .update({ name: input.name, status: input.status })
    .eq("user_id", newUserId);

  await supabase.from("activity_logs").insert({
    user_id: callerId,
    action: "admin_create_user",
    entity: "user",
    entity_id: newUserId,
    metadata: { email: input.email, role: input.role },
  });

  return { ok: true, userId: newUserId };
}

export async function adminUpdateUserSrv(
  supabase: SupabaseClient,
  callerId: string,
  input: {
    targetUserId: string;
    role?: "admin" | "operator";
    status?: "active" | "inactive";
    name?: string;
  },
) {
  await ensureAdmin(supabase, callerId);

  if (input.name !== undefined || input.status !== undefined) {
    const upd: { name?: string; status?: string } = {};
    if (input.name !== undefined) upd.name = input.name;
    if (input.status !== undefined) upd.status = input.status;
    await supabaseAdmin.from("users_profile").update(upd).eq("user_id", input.targetUserId);
  }

  if (input.role) {
    if (input.role === "admin") {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: input.targetUserId, role: "admin" },
          { onConflict: "user_id,role" },
        );
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", input.targetUserId)
        .eq("role", "admin");
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: input.targetUserId, role: "operator" },
          { onConflict: "user_id,role" },
        );
    }
  }

  await supabase.from("activity_logs").insert({
    user_id: callerId,
    action: "admin_update_user",
    entity: "user",
    entity_id: input.targetUserId,
    metadata: input,
  });

  return { ok: true };
}

export async function adminListUsersSrv(supabase: SupabaseClient, callerId: string) {
  await ensureAdmin(supabase, callerId);
  const { data: profiles } = await supabaseAdmin
    .from("users_profile")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
  const roleMap = new Map<string, string[]>();
  (roles || []).forEach((r) => {
    const arr = roleMap.get(r.user_id) || [];
    arr.push(r.role);
    roleMap.set(r.user_id, arr);
  });
  return (profiles || []).map((p) => ({
    ...p,
    role: roleMap.get(p.user_id)?.includes("admin") ? "admin" : "operator",
  }));
}

export async function adminDeleteUserSrv(
  supabase: SupabaseClient,
  callerId: string,
  targetUserId: string,
) {
  await ensureAdmin(supabase, callerId);
  if (callerId === targetUserId) throw new Error("Cannot delete your own account");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
  if (error) throw error;
  await supabase.from("activity_logs").insert({
    user_id: callerId,
    action: "admin_delete_user",
    entity: "user",
    entity_id: targetUserId,
  });
  return { ok: true };
}
