// Shared notification helper — inserts the in-app notification row (the
// bell/notifications page previously had nothing to show since no call site
// ever created one) and, if the recipient has opted into email, also sends a
// real email via Resend. Callers just describe the event once.
import { sendEmail, emailTemplate } from "@/lib/email";
import type { NotifType } from "@/lib/notifications.functions";

export async function notifyUser(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  params: {
    userId: string;
    type: NotifType;
    title: string;
    body: string;
    link?: string;
    emailCtaLabel?: string;
  },
): Promise<void> {
  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("in_app,email_enabled")
    .eq("user_id", params.userId)
    .maybeSingle();
  // No prefs row yet = defaults (all in-app types on, email off) — matches
  // getPreferences()'s fallback in notifications.functions.ts.
  const inAppEnabled =
    (prefs?.in_app as Record<string, boolean> | undefined)?.[params.type] ?? true;
  if (inAppEnabled) {
    await supabaseAdmin.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
    });
  }

  if (!prefs?.email_enabled) return;

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("email")
    .eq("id", params.userId)
    .maybeSingle();
  if (!employee?.email) return;

  const { getSiteOrigin } = await import("@/lib/site-origin");
  await sendEmail({
    to: employee.email,
    subject: params.title,
    html: emailTemplate({
      heading: params.title,
      body: params.body,
      ctaLabel: params.link ? (params.emailCtaLabel ?? "View") : undefined,
      ctaUrl: params.link ? `${getSiteOrigin()}${params.link}` : undefined,
    }),
  });
}

// Broadcasts to every active employee — used for announcements. Runs
// sequentially like the other admin bulk operations in this codebase (bulk
// CSV import, bulk status changes); fine at this app's employee-count scale.
export async function notifyAllActiveEmployees(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  params: { type: NotifType; title: string; body: string; link?: string; emailCtaLabel?: string },
): Promise<void> {
  const { data: employees } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("status", "active");
  for (const emp of employees ?? []) {
    await notifyUser(supabaseAdmin, { ...params, userId: emp.id });
  }
}
