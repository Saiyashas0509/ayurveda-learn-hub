// Central audit-logging helper. Every write here also captures the caller's
// IP and User-Agent (from the raw request, Cloudflare-aware) so the admin
// activity log can show device/browser info without a schema change — both
// audit_logs.ip and audit_logs.metadata already exist for this purpose.
import { getRequest } from "@tanstack/react-start/server";

export type ClientInfo = {
  ip: string | null;
  userAgent: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
};

export function getClientInfo(): ClientInfo {
  try {
    const request = getRequest();
    const headers = request?.headers;
    if (!headers) return { ip: null, userAgent: null, city: null, country: null, region: null };
    const ip =
      headers.get("cf-connecting-ip") ??
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    return {
      ip,
      userAgent: headers.get("user-agent"),
      city: headers.get("x-geo-city"),
      country: headers.get("x-geo-country"),
      region: headers.get("x-geo-region"),
    };
  } catch {
    return { ip: null, userAgent: null, city: null, country: null, region: null };
  }
}

export async function logAudit(params: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { ip, userAgent, city, country, region } = getClientInfo();
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: params.actorId ?? null,
    actor_email: params.actorEmail ?? null,
    action: params.action,
    target: params.target ?? null,
    ip,
    metadata: {
      ...(params.metadata ?? {}),
      user_agent: userAgent,
      city: city ?? undefined,
      country: country ?? undefined,
      region: region ?? undefined,
    },
  });
}
