// Email delivery layered on top of the *existing* in-app notification system.
//
// This does NOT insert into `notifications` — that's already handled by DB
// triggers (tg_notify_assignment, tg_notify_grade, tg_notify_announcement,
// tg_notify_live_class, tg_notify_reply — see the enqueue_notification()
// migration) that fire automatically on the relevant INSERT/UPDATE and
// already respect each user's per-type in_app preference, with better
// audience targeting than a naive "all active employees" broadcast would
// give (e.g. assignments only notify people with progress in that course;
// announcements respect audience_roles). An earlier version of this file
// duplicated that logic at the application layer, which produced two
// notification rows per event. Triggers can't send email (no HTTP capability
// in this Supabase project), so that's the one thing actually missing —
// this file adds exactly that, sourcing the email's content from the same
// notification row the trigger just created so the two channels can never
// drift out of sync.
import { sendEmail, emailTemplate } from "@/lib/email";

async function sendIfEmailEnabled(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  userId: string,
  params: { title: string; body: string; link: string | null; ctaLabel?: string },
): Promise<void> {
  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("email_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (!prefs?.email_enabled) return;

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (!employee?.email) return;

  const { getSiteOrigin } = await import("@/lib/site-origin");
  await sendEmail({
    to: employee.email,
    subject: params.title,
    html: emailTemplate({
      heading: params.title,
      body: params.body,
      ctaLabel: params.link ? (params.ctaLabel ?? "View") : undefined,
      ctaUrl: params.link ? `${getSiteOrigin()}${params.link}` : undefined,
    }),
  });
}

// For single-recipient events (e.g. a submission being graded) where the
// caller already knows exactly who to notify and doesn't need to look up
// what the trigger inserted.
export async function emailUser(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  params: { userId: string; title: string; body: string; link?: string; ctaLabel?: string },
): Promise<void> {
  await sendIfEmailEnabled(supabaseAdmin, params.userId, {
    title: params.title,
    body: params.body,
    link: params.link ?? null,
    ctaLabel: params.ctaLabel,
  });
}

// For broadcast events (announcements, new assignments) where a DB trigger
// already computed the right audience and inserted one notifications row per
// recipient. Reads those rows back (matched via a unique field in `data`,
// e.g. { announcement_id: "..." }) and emails whichever of those recipients
// have opted into email — so the email audience is always exactly the
// in-app audience, never a separately-maintained list that can drift.
export async function emailNotificationRecipients(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  params: {
    type: string;
    dataMatch: Record<string, string>;
    ctaLabel?: string;
    excludeUserId?: string;
  },
): Promise<void> {
  const { data: rows } = await supabaseAdmin
    .from("notifications")
    .select("user_id,title,body,link")
    .eq("type", params.type)
    .contains("data", params.dataMatch);

  for (const row of rows ?? []) {
    if (params.excludeUserId && row.user_id === params.excludeUserId) continue;
    await sendIfEmailEnabled(supabaseAdmin, row.user_id, {
      title: row.title,
      body: row.body ?? "",
      link: row.link,
      ctaLabel: params.ctaLabel,
    });
  }
}
