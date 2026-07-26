// Authorizes direct browser-to-Hostinger video uploads/deletes. The Worker
// never touches the file bytes (that would hit Cloudflare's ~100MB edge
// upload cap, which real lesson videos routinely exceed) — it only checks
// the caller is signed in with a faculty/admin role and mints a short-lived
// signed token for one exact filename + action. The browser then sends the
// actual bytes straight to the PHP relay living on Hostinger, which verifies
// the token with the same shared secret before writing/deleting anything.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { signUploadToken } from "@/lib/upload-token";
import { logAudit } from "@/lib/audit";

const FACULTY_ROLES = ["super_admin", "hr_admin", "trainer", "faculty"] as const;

const VIDEO_UPLOAD_URL = "https://videos.travancoreayurvedalearning.com/upload-relay.php";

async function assertFaculty(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...FACULTY_ROLES]);
  if (!data || data.length === 0) throw new Error("Forbidden: faculty or admin role required");
}

// Strips anything unsafe in a filesystem path or URL segment. Blocks path
// traversal and command-injection-adjacent characters in the filename the
// PHP relay will write to disk.
function sanitizeUploadFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-150) || "file";
}

export const requestVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filename: string }) =>
    z.object({ filename: z.string().trim().min(1).max(255) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const secret = process.env.HOSTINGER_UPLOAD_SECRET;
    if (!secret) throw new Error("Video upload is not configured");

    const filename = `${Date.now()}-${sanitizeUploadFilename(data.filename)}`;
    // Chunked uploads of a large video over a slow connection can take a
    // while cumulatively — give this token an hour instead of the default 10
    // minutes so it doesn't expire mid-upload.
    const { exp, sig } = await signUploadToken("upload", filename, secret, 3600);
    return { uploadUrl: VIDEO_UPLOAD_URL, filename, exp, sig };
  });

export const requestVideoDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filename: string }) =>
    z.object({ filename: z.string().trim().min(1).max(255) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const secret = process.env.HOSTINGER_UPLOAD_SECRET;
    if (!secret) throw new Error("Video upload is not configured");

    const filename = sanitizeUploadFilename(data.filename);
    const { exp, sig } = await signUploadToken("delete", filename, secret);
    return { uploadUrl: VIDEO_UPLOAD_URL, filename, exp, sig };
  });

// Authorizes reading the duration of a video that's already on Hostinger
// (used for the "type an existing filename" path and for backfilling older
// lessons) — same signed-token pattern as upload/delete.
export const requestVideoDuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filename: string }) =>
    z.object({ filename: z.string().trim().min(1).max(255) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const secret = process.env.HOSTINGER_UPLOAD_SECRET;
    if (!secret) throw new Error("Video upload is not configured");

    const filename = sanitizeUploadFilename(data.filename);
    const { exp, sig } = await signUploadToken("duration", filename, secret);
    return { uploadUrl: VIDEO_UPLOAD_URL, filename, exp, sig };
  });

// Previously a failed upload left zero trace anywhere except the toast in
// the uploader's own browser — diagnosing a real report meant asking them
// to describe or screenshot an error that had already scrolled away. This
// gives it a permanent record (visible on the Audit Logs page) with enough
// detail — file size, how far it got, browser/OS — to actually tell a real
// server/relay problem apart from one flaky connection, without waiting for
// it to happen again in front of someone who can read devtools.
export const reportUploadFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      filename: string;
      fileSizeBytes: number;
      chunkIndex: number;
      totalChunks: number;
      percentComplete: number;
      errorMessage: string;
    }) =>
      z
        .object({
          filename: z.string().max(255),
          fileSizeBytes: z.number().int().min(0),
          chunkIndex: z.number().int().min(0),
          totalChunks: z.number().int().min(1),
          percentComplete: z.number().min(0).max(100),
          errorMessage: z.string().max(500),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "video_upload_failed",
      metadata: {
        filename: data.filename,
        fileSizeBytes: data.fileSizeBytes,
        fileSizeMB: Math.round((data.fileSizeBytes / (1024 * 1024)) * 10) / 10,
        chunkIndex: data.chunkIndex,
        totalChunks: data.totalChunks,
        percentComplete: data.percentComplete,
        errorMessage: data.errorMessage,
      },
    });
    return { ok: true };
  });
