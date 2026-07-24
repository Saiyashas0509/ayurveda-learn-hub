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
};
