// Server-only (see the .server.ts naming convention in client.server.ts) —
// this needs a top-level `cloudflare:workers` import for the AI binding,
// which cannot be resolved at all in a browser bundle. transcription.functions.ts
// ships to the client (it's a *.functions.ts, needed there for useServerFn),
// so the actual transcription logic lives here instead and is only ever
// reached via a dynamic `await import(...)` from server-side handler code.
//
// Transcribes via Cloudflare Workers AI's Whisper model — runs on the same
// Cloudflare account already hosting this app (see the `ai` binding in
// wrangler.jsonc), so it needs no separate signup or API key, unlike the
// OpenAI/Groq Whisper endpoints this replaced. Free within the account's
// daily Workers AI allocation; fractions of a cent per audio-minute beyond
// that.
//
// Cloudflare doesn't publish a file-size limit for this model, so this cap
// is set from real testing against this exact Worker rather than a spec
// sheet: two genuine production training videos (28MB and 173MB, real
// speech, not synthetic filler) both transcribed correctly in ~4 seconds
// each via env.AI.run() — no memory/timeout issues at either size. 200MB
// keeps a margin below the largest size actually verified (173MB) rather
// than extrapolating past tested ground.
import { VIDEO_BASE_URL } from "@/lib/upload-video";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

type SupabaseAdmin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

type WhisperResponse = {
  text?: string;
  transcription_info?: { text?: string };
};

export async function transcribeVideo(
  supabaseAdmin: SupabaseAdmin,
  lessonId: string,
): Promise<string> {
  const { data: lesson } = await supabaseAdmin
    .from("lessons")
    .select("id,video_url")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson?.video_url) throw new Error("This lesson doesn't have a video yet.");

  // Only ever fetch from our own known video host — video_url is settable
  // via updateLesson by any faculty/trainer account (including self-signup
  // ones), so without this a lesson could be pointed at an arbitrary
  // internal or third-party URL and have this server fetch it (SSRF).
  if (!lesson.video_url.startsWith(VIDEO_BASE_URL)) {
    throw new Error(
      "Automatic transcription only works for videos uploaded through this platform.",
    );
  }

  const mbOf = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
  const overLimitMessage = (bytes: number) =>
    `This video is ${mbOf(bytes)}MB — automatic transcription tops out around ` +
    `${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB on this server. You can still add a ` +
    "transcript manually below — automatic quiz generation still works from that.";

  const headRes = await fetch(lesson.video_url, { method: "HEAD" });
  const size = Number(headRes.headers.get("content-length") ?? "0");
  if (size > 0 && size > MAX_VIDEO_BYTES) {
    throw new Error(overLimitMessage(size));
  }

  const videoRes = await fetch(lesson.video_url);
  if (!videoRes.ok) throw new Error("Could not download the video to transcribe it.");
  const videoBuf = await videoRes.arrayBuffer();
  if (videoBuf.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(overLimitMessage(videoBuf.byteLength));
  }

  const { env } = await import("cloudflare:workers");
  // Base64 string, not a raw byte array — this model's input type only
  // accepts a string (or a body/contentType wrapper); a plain `number[]` is
  // what the *base* @cf/openai/whisper model takes, not this turbo variant,
  // and would fail to typecheck (and to actually work) here.
  const base64Audio = Buffer.from(videoBuf).toString("base64");
  // One retry — a binding call to a separate Cloudflare service is a network
  // hop like any other API call, and a bare one-shot attempt has no
  // resilience against a single transient hiccup.
  let response: WhisperResponse | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = (await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
        audio: base64Audio,
      })) as WhisperResponse;
      break;
    } catch (e) {
      lastError = e;
      console.error(`[transcription] Workers AI error (attempt ${attempt}/2):`, e);
    }
  }
  if (!response) {
    throw new Error(
      `Transcription failed${lastError instanceof Error ? `: ${lastError.message}` : ""}. Please try again in a moment.`,
    );
  }

  const transcript = (response.transcription_info?.text ?? response.text ?? "").trim();
  if (!transcript) throw new Error("Transcription returned no text.");

  await supabaseAdmin.from("lessons").update({ transcript }).eq("id", lessonId);
  return transcript;
}
