import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { verifyMediaToken } from "./lib/media-token";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type MediaEnv = {
  MEDIA_SIGNING_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const LESSON_MEDIA_PATH = /^\/media\/lessons\/([0-9a-fA-F-]{36})$/;

// Handles /media/lessons/:id directly, before the app router ever sees the
// request. The client only ever gets this signed-token URL, never the real
// (Hostinger) video URL — that's fetched here, server-side, and streamed
// through, so it's never exposed to the browser or saveable as a plain link.
async function handleLessonMedia(request: Request, env: MediaEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(LESSON_MEDIA_PATH);
  if (!match) return null;
  const lessonId = match[1];

  const secret = env.MEDIA_SIGNING_SECRET;
  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceKey) {
    return new Response("Media proxy not configured", { status: 500 });
  }

  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  const valid = await verifyMediaToken(lessonId, exp, sig, secret);
  if (!valid) return new Response("Forbidden", { status: 403 });

  const lookup = await fetch(`${supabaseUrl}/rest/v1/lessons?id=eq.${lessonId}&select=video_url`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });
  const rows = (await lookup.json()) as { video_url: string | null }[];
  const videoUrl = rows[0]?.video_url;
  if (!videoUrl) return new Response("Not found", { status: 404 });

  const originHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) originHeaders.set("range", range);

  const originRes = await fetch(videoUrl, { headers: originHeaders });
  if (!originRes.ok && originRes.status !== 206) {
    return new Response("Upstream error", { status: 502 });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
    const v = originRes.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "private, no-store");

  return new Response(originRes.body, { status: originRes.status, headers });
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Cloudflare attaches approximate geolocation to every request via `request.cf`
// — free, no external API call needed. That property doesn't survive into
// TanStack Start's request wrapping, so it's forwarded as headers instead;
// server functions read it back via getClientInfo() in lib/audit.ts.
function withGeoHeaders(request: Request): Request {
  const cf = (request as unknown as { cf?: { city?: string; country?: string; region?: string } })
    .cf;
  if (!cf) return request;
  const headers = new Headers(request.headers);
  if (cf.city) headers.set("x-geo-city", cf.city);
  if (cf.country) headers.set("x-geo-country", cf.country);
  if (cf.region) headers.set("x-geo-region", cf.region);
  return new Request(request, { headers });
}

// Daily Cloudflare Cron Trigger (see wrangler.jsonc's [triggers].crons) —
// flags certificates entering their last 30 days before expiry and emails
// the learner once per certificate (expiry_notified_at gates the resend).
// A free-tier Worker cron, not a Supabase Edge Function — no extra
// platform/credentials needed beyond what's already deployed.
async function runCertificateExpiryCheck(env: Record<string, string | undefined>): Promise<void> {
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  const { supabaseAdmin } = await import("./integrations/supabase/client.server");
  const { emailUser } = await import("./lib/notify");

  const warnBy = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: expiring } = await supabaseAdmin
    .from("certificates")
    .select("id,cert_code,user_id,expires_at,courses(title)")
    .not("expires_at", "is", null)
    .lte("expires_at", warnBy)
    .is("expiry_notified_at", null);

  for (const cert of expiring ?? []) {
    const courseTitle = (cert.courses as { title?: string } | null)?.title ?? "your course";
    const isExpired = new Date(cert.expires_at as string) < new Date();
    try {
      await emailUser(supabaseAdmin, {
        userId: cert.user_id,
        title: isExpired ? "Your certificate has expired" : "Your certificate is expiring soon",
        body: isExpired
          ? `Your certificate for "${courseTitle}" expired on ${new Date(cert.expires_at as string).toLocaleDateString()}. Please retake the course to renew it.`
          : `Your certificate for "${courseTitle}" expires on ${new Date(cert.expires_at as string).toLocaleDateString()}. Retake the course to renew it before then.`,
        link: "/certificates",
        ctaLabel: "View certificate",
      });
    } catch (e) {
      console.error(`Expiry email failed for certificate ${cert.cert_code}`, e);
    }
    await supabaseAdmin
      .from("certificates")
      .update({ expiry_notified_at: new Date().toISOString() })
      .eq("id", cert.id);
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const mediaResponse = await handleLessonMedia(request, env as MediaEnv);
      if (mediaResponse) return mediaResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(withGeoHeaders(request), env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },

  async scheduled(
    _event: unknown,
    env: Record<string, string | undefined>,
    ctx: { waitUntil: (p: Promise<unknown>) => void },
  ) {
    ctx.waitUntil(
      runCertificateExpiryCheck(env).catch((e) =>
        console.error("Certificate expiry check failed", e),
      ),
    );
  },
};
