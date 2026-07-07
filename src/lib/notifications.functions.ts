// In-app notifications: list, mark read, preferences.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type NotifType = "assignment" | "result" | "live_class" | "announcement" | "discussion" | "system";
export const NOTIF_TYPES: NotifType[] = ["assignment", "result", "live_class", "announcement", "discussion", "system"];

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { unreadOnly?: boolean; limit?: number }) =>
    z.object({ unreadOnly: z.boolean().optional(), limit: z.number().int().min(1).max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("notifications")
      .select("id,type,title,body,link,is_read,read_at,created_at,data")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.unreadOnly) q = q.eq("is_read", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const { count } = await context.supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("is_read", false);
    return { items: rows ?? [], unreadCount: count ?? 0 };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; read?: boolean }) =>
    z.object({ ids: z.array(z.string().uuid()).max(200), read: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const read = data.read ?? true;
    const { error } = await context.supabase.from("notifications")
      .update({ is_read: read, read_at: read ? new Date().toISOString() : null })
      .in("id", data.ids).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", context.userId).eq("is_read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("notification_preferences")
      .select("in_app,email_enabled,sms_enabled").eq("user_id", context.userId).maybeSingle();
    return data ?? {
      in_app: Object.fromEntries(NOTIF_TYPES.map((t) => [t, true])) as Record<string, boolean>,
      email_enabled: false, sms_enabled: false,
    };
  });

export const updatePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inApp: Record<string, boolean>; emailEnabled?: boolean; smsEnabled?: boolean }) =>
    z.object({
      inApp: z.record(z.string(), z.boolean()),
      emailEnabled: z.boolean().optional(),
      smsEnabled: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notification_preferences").upsert({
      user_id: context.userId,
      in_app: data.inApp,
      email_enabled: data.emailEnabled ?? false,
      sms_enabled: data.smsEnabled ?? false,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
