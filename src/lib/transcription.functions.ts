// Automatic video transcription via OpenAI's Whisper API — same provider/key
// as the AI assistant (ai-assistant.functions.ts), so one OpenAI account
// covers both instead of two separate provider setups.
//
// Whisper's API caps uploads at 25MB. Real lesson videos routinely exceed
// that, and extracting just the audio track first (which would usually fit)
// needs ffmpeg or similar — not available in this app's Cloudflare Workers
// runtime or on Hostinger's shared PHP hosting. So this works directly for
// shorter/smaller lesson videos and returns a clear, specific error for
// anything over the limit rather than failing silently or guessing.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { VIDEO_BASE_URL } from "@/lib/upload-video";

const FACULTY_ROLES = ["super_admin", "hr_admin", "trainer", "faculty"] as const;
const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

async function assertFaculty(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...FACULTY_ROLES]);
  if (!data || data.length === 0) throw new Error("Forbidden: faculty or admin role required");
}

export const transcribeLessonVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lessonId: string }) =>
    z.object({ lessonId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Transcription isn't set up yet — add the OpenAI API key first.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("id,video_url")
      .eq("id", data.lessonId)
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

    const headRes = await fetch(lesson.video_url, { method: "HEAD" });
    const size = Number(headRes.headers.get("content-length") ?? "0");
    if (size > 0 && size > MAX_WHISPER_BYTES) {
      const mb = Math.round(size / 1024 / 1024);
      throw new Error(
        `This video is ${mb}MB — automatic transcription only supports files up to 25MB. ` +
          "You can still add a transcript manually below.",
      );
    }

    const videoRes = await fetch(lesson.video_url);
    if (!videoRes.ok) throw new Error("Could not download the video to transcribe it.");
    const videoBlob = await videoRes.blob();
    if (videoBlob.size > MAX_WHISPER_BYTES) {
      const mb = Math.round(videoBlob.size / 1024 / 1024);
      throw new Error(
        `This video is ${mb}MB — automatic transcription only supports files up to 25MB. ` +
          "You can still add a transcript manually below.",
      );
    }

    const form = new FormData();
    form.append("file", videoBlob, "lesson-video");
    form.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!whisperRes.ok) {
      const body = await whisperRes.text().catch(() => "");
      console.error("[transcription] Whisper error:", whisperRes.status, body);
      throw new Error("Transcription failed. Please try again in a moment.");
    }
    const json = (await whisperRes.json()) as { text?: string };
    const transcript = json.text?.trim();
    if (!transcript) throw new Error("Transcription returned no text.");

    await supabaseAdmin.from("lessons").update({ transcript }).eq("id", data.lessonId);
    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "lesson_transcribed",
      target: data.lessonId,
    });

    return { transcript };
  });
