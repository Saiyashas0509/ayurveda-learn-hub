// Ships to the client (needed for useServerFn) — the actual transcription
// logic (which needs a top-level `cloudflare:workers` import, unresolvable
// in a browser bundle) lives in transcription.server.ts and is only ever
// reached here via a dynamic import inside this handler.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const FACULTY_ROLES = ["super_admin", "hr_admin", "trainer", "faculty"] as const;

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { transcribeVideo } = await import("@/lib/transcription.server");
    const transcript = await transcribeVideo(supabaseAdmin, data.lessonId);
    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "lesson_transcribed",
      target: data.lessonId,
    });
    return { transcript };
  });
