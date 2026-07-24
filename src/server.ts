import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { verifyMediaToken } from "./lib/media-token";
import { ftpDelete, ftpList, ftpUploadFile } from "./lib/ftp-client.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type MediaEnv = {
  MEDIA_SIGNING_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type UploadEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  FTP_HOST?: string;
  FTP_PORT?: string;
  FTP_USER?: string;
  FTP_PASSWORD?: string;
};

const VIDEO_UPLOAD_PATH = "/api/admin/upload-video";
const VIDEO_REMOTE_DIR = "/domains/travancoreayurvedalearning.com/public_html/videos";
const VIDEO_PUBLIC_BASE = "https://videos.travancoreayurvedalearning.com";
const FACULTY_ROLES = new Set(["super_admin", "hr_admin", "trainer", "faculty"]);

// Strip anything that isn't safe in an FTP command or a URL path segment.
// Blocks CRLF-based FTP command injection and path traversal via filenames.
function sanitizeUploadFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-150) || "file";
}

async function handleVideoUpload(request: Request, env: UploadEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== VIDEO_UPLOAD_PATH) return null;
  if (request.method !== "POST" && request.method !== "DELETE" && request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FTP_HOST, FTP_USER, FTP_PASSWORD } = env;
  const FTP_PORT = Number(env.FTP_PORT ?? "21");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    return new Response(JSON.stringify({ error: "Upload not configured" }), { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const claimsRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` },
  });
  if (!claimsRes.ok)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const user = (await claimsRes.json()) as { id?: string };
  if (!user.id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const rolesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${user.id}&select=role`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  const roles = (await rolesRes.json()) as { role: string }[];
  if (!roles.some((r) => FACULTY_ROLES.has(r.role))) {
    return new Response(JSON.stringify({ error: "Forbidden: faculty or admin role required" }), {
      status: 403,
    });
  }

  const ftpConfig = { host: FTP_HOST, port: FTP_PORT, user: FTP_USER, password: FTP_PASSWORD };

  if (request.method === "GET") {
    // Lists what's already on Hostinger so admins can pick an existing file
    // instead of re-uploading, and pastes back the ready-to-use public URL.
    try {
      const listing = await ftpList(ftpConfig, VIDEO_REMOTE_DIR);
      const files = listing
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("d") && !/\s\.\.?$/.test(line))
        .map((line) => line.split(/\s+/).slice(8).join(" "))
        .filter((name) => name && name !== "default.php")
        .map((name) => ({ name, url: `${VIDEO_PUBLIC_BASE}/${encodeURIComponent(name)}` }));
      return new Response(JSON.stringify({ files }), {
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      console.error("[upload-video] FTP list failed:", err);
      return new Response(JSON.stringify({ error: "List failed" }), { status: 502 });
    }
  }

  if (request.method === "DELETE") {
    // Only ever touches files inside VIDEO_REMOTE_DIR — filename is sanitized
    // (no slashes survive), so this can't be pointed outside that directory.
    const target = sanitizeUploadFilename(url.searchParams.get("filename") ?? "");
    if (!target)
      return new Response(JSON.stringify({ error: "Missing filename" }), { status: 400 });
    try {
      await ftpDelete(ftpConfig, `${VIDEO_REMOTE_DIR}/${target}`);
    } catch (err) {
      console.error("[upload-video] FTP delete failed:", err);
      return new Response(JSON.stringify({ error: "Delete failed" }), { status: 502 });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  const rawName = url.searchParams.get("filename") ?? "video.mp4";
  const filename = `${Date.now()}-${sanitizeUploadFilename(rawName)}`;
  if (!request.body) return new Response(JSON.stringify({ error: "Empty body" }), { status: 400 });

  try {
    await ftpUploadFile(ftpConfig, `${VIDEO_REMOTE_DIR}/${filename}`, request.body);
  } catch (err) {
    console.error("[upload-video] FTP upload failed:", err);
    return new Response(JSON.stringify({ error: "Upload to storage failed" }), { status: 502 });
  }

  return new Response(
    JSON.stringify({ url: `${VIDEO_PUBLIC_BASE}/${encodeURIComponent(filename)}` }),
    {
      headers: { "content-type": "application/json" },
    },
  );
}

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

      const uploadResponse = await handleVideoUpload(request, env as UploadEnv);
      if (uploadResponse) return uploadResponse;

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
