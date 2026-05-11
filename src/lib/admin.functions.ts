import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminCreateUserSrv,
  adminUpdateUserSrv,
  adminListUsersSrv,
  adminDeleteUserSrv,
} from "./admin.server";

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    email: string;
    password: string;
    name: string;
    role: "admin" | "operator";
    status: "active" | "inactive";
  }) => d)
  .handler(async ({ data, context }) => {
    return await adminCreateUserSrv(context.supabase, context.userId, data);
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    targetUserId: string;
    role?: "admin" | "operator";
    status?: "active" | "inactive";
    name?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    return await adminUpdateUserSrv(context.supabase, context.userId, data);
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await adminListUsersSrv(context.supabase, context.userId);
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string }) => d)
  .handler(async ({ data, context }) => {
    return await adminDeleteUserSrv(context.supabase, context.userId, data.targetUserId);
  });
