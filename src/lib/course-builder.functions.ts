// Faculty/admin authoring: courses, modules, lessons, resources, publish, assignments.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const FACULTY_ROLES = ["super_admin", "hr_admin", "trainer", "faculty"] as const;

function actorEmail(context: { claims: unknown }): string | null {
  return (context.claims as { email?: string }).email ?? null;
}

async function assertFaculty(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...FACULTY_ROLES]);
  if (!data || data.length === 0) throw new Error("Forbidden: faculty or admin role required");
}

// courses.duration_minutes is derived from its lessons' actual video lengths
// rather than hand-entered, so it can never drift out of sync with the videos.
async function recomputeCourseDuration(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  courseId: string,
) {
  const { data } = await supabaseAdmin
    .from("lessons")
    .select("duration_seconds")
    .eq("course_id", courseId);
  const totalSeconds = (data ?? []).reduce(
    (sum: number, l: { duration_seconds: number | null }) => sum + (l.duration_seconds ?? 0),
    0,
  );
  await supabaseAdmin
    .from("courses")
    .update({ duration_minutes: Math.round(totalSeconds / 60) })
    .eq("id", courseId);
}

export const listAuthoredCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("courses")
      .select("id,title,slug,status,is_published,version,last_published_at,updated_at,cover_url")
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

export const getCourseForEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) =>
    z.object({ courseId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [course, modules, lessons, quizzes, assignments] = await Promise.all([
      supabaseAdmin.from("courses").select("*").eq("id", data.courseId).maybeSingle(),
      supabaseAdmin
        .from("course_modules")
        .select("*")
        .eq("course_id", data.courseId)
        .order("sort_order"),
      supabaseAdmin.from("lessons").select("*").eq("course_id", data.courseId).order("sort_order"),
      supabaseAdmin
        .from("quizzes")
        .select("id,title,lesson_id,pass_percent")
        .eq("course_id", data.courseId),
      supabaseAdmin
        .from("assignments")
        .select("*")
        .eq("course_id", data.courseId)
        .order("created_at"),
    ]);
    if (!course.data) throw new Error("Course not found");
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "course_viewed",
      target: data.courseId,
      metadata: { title: course.data.title },
    });
    return {
      course: course.data,
      modules: modules.data ?? [],
      lessons: lessons.data ?? [],
      quizzes: quizzes.data ?? [],
      assignments: assignments.data ?? [],
    };
  });

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const upsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      title: string;
      description?: string;
      cover_url?: string | null;
      preview_allowed?: boolean;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          title: z.string().trim().min(2).max(200),
          description: z.string().max(4000).optional(),
          cover_url: z.string().max(1000).nullable().optional(),
          preview_allowed: z.boolean().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      // duration_minutes is intentionally not writable here — it's derived
      // from lesson video lengths by recomputeCourseDuration.
      const { error } = await supabaseAdmin
        .from("courses")
        .update({
          title: data.title,
          description: data.description ?? null,
          cover_url: data.cover_url ?? null,
          preview_allowed: data.preview_allowed ?? false,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit({
        actorId: context.userId,
        actorEmail: actorEmail(context),
        action: "course_updated",
        target: data.id,
        metadata: { title: data.title },
      });
      return { id: data.id };
    }
    const base = slugify(data.title) || "course";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: inserted, error } = await supabaseAdmin
      .from("courses")
      .insert({
        title: data.title,
        slug,
        description: data.description ?? null,
        cover_url: data.cover_url ?? null,
        preview_allowed: data.preview_allowed ?? false,
        duration_minutes: 0,
        created_by: context.userId,
        status: "draft",
        is_published: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "course_created",
      target: inserted.id,
      metadata: { title: data.title },
    });
    return { id: inserted.id };
  });

export const createModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string; title: string }) =>
    z.object({ courseId: z.string().uuid(), title: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("course_modules")
      .select("*", { count: "exact", head: true })
      .eq("course_id", data.courseId);
    const { data: row, error } = await supabaseAdmin
      .from("course_modules")
      .insert({
        course_id: data.courseId,
        title: data.title,
        sort_order: count ?? 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "module_created",
      target: row.id,
      metadata: { title: data.title, courseId: data.courseId },
    });
    return row;
  });

export const updateModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; title?: string; description?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(200).optional(),
        description: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("course_modules")
      .update({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      })
      .eq("id", data.id);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "module_updated",
      target: data.id,
    });
    return { ok: true };
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("course_modules").delete().eq("id", data.id);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "module_deleted",
      target: data.id,
    });
    return { ok: true };
  });

export const reorderModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderedIds: string[] }) =>
    z.object({ orderedIds: z.array(z.string().uuid()).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all(
      data.orderedIds.map((id, i) =>
        supabaseAdmin.from("course_modules").update({ sort_order: i }).eq("id", id),
      ),
    );
    return { ok: true };
  });

export const createLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string; moduleId?: string | null; title: string }) =>
    z
      .object({
        courseId: z.string().uuid(),
        moduleId: z.string().uuid().nullable().optional(),
        title: z.string().trim().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = supabaseAdmin
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("course_id", data.courseId);
    const { count } = data.moduleId ? await q.eq("module_id", data.moduleId) : await q;
    const { data: row, error } = await supabaseAdmin
      .from("lessons")
      .insert({
        course_id: data.courseId,
        module_id: data.moduleId ?? null,
        title: data.title,
        sort_order: count ?? 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "lesson_created",
      target: row.id,
      metadata: { title: data.title, courseId: data.courseId },
    });
    return row;
  });

export const updateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      title?: string;
      description?: string;
      video_url?: string | null;
      duration_seconds?: number;
      preview_allowed?: boolean;
      key_notes?: string;
      transcript?: string;
      resources?: unknown;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          title: z.string().max(200).optional(),
          description: z.string().max(4000).optional(),
          video_url: z.string().max(1000).nullable().optional(),
          duration_seconds: z.number().int().min(0).optional(),
          preview_allowed: z.boolean().optional(),
          key_notes: z.string().max(4000).optional(),
          transcript: z.string().max(20000).optional(),
          resources: z
            .array(
              z.object({
                id: z.string(),
                name: z.string(),
                url: z.string(),
                kind: z.string(),
                size: z.number().optional(),
              }),
            )
            .optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      title?: string;
      description?: string;
      video_url?: string | null;
      duration_seconds?: number;
      preview_allowed?: boolean;
      key_notes?: string;
      transcript?: string;
      resources?: unknown;
    } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.video_url !== undefined) patch.video_url = data.video_url;
    if (data.duration_seconds !== undefined) patch.duration_seconds = data.duration_seconds;
    if (data.preview_allowed !== undefined) patch.preview_allowed = data.preview_allowed;
    if (data.key_notes !== undefined) patch.key_notes = data.key_notes;
    if (data.transcript !== undefined) patch.transcript = data.transcript;
    if (data.resources !== undefined) patch.resources = data.resources;
    const { data: updated, error } = await supabaseAdmin
      .from("lessons")
      .update(patch as never)
      .eq("id", data.id)
      .select("course_id")
      .single();
    if (error) throw new Error(error.message);
    if (data.duration_seconds !== undefined) {
      await recomputeCourseDuration(supabaseAdmin, updated.course_id);
    }
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "lesson_updated",
      target: data.id,
      metadata: { courseId: updated.course_id, fields: Object.keys(patch) },
    });
    return { ok: true };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deleted } = await supabaseAdmin
      .from("lessons")
      .delete()
      .eq("id", data.id)
      .select("course_id")
      .single();
    if (deleted) await recomputeCourseDuration(supabaseAdmin, deleted.course_id);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "lesson_deleted",
      target: data.id,
      metadata: { courseId: deleted?.course_id },
    });
    return { ok: true };
  });

export const reorderLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { moduleId: string | null; orderedIds: string[] }) =>
    z
      .object({
        moduleId: z.string().uuid().nullable(),
        orderedIds: z.array(z.string().uuid()).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all(
      data.orderedIds.map((id, i) =>
        supabaseAdmin
          .from("lessons")
          .update({ sort_order: i, module_id: data.moduleId })
          .eq("id", id),
      ),
    );
    return { ok: true };
  });

export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bucket: "course-media" | "assignment-submissions"; path: string }) =>
    z
      .object({
        bucket: z.enum(["course-media", "assignment-submissions"]),
        path: z.string().min(1).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // course-media requires faculty; assignment-submissions requires student-owned path
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.bucket === "course-media") {
      await assertFaculty(context.userId);
    } else {
      if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Invalid path for user");
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUploadUrl(data.path);
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from(data.bucket).getPublicUrl(data.path);
    return {
      signedUrl: signed.signedUrl,
      token: signed.token,
      path: data.path,
      publicUrl: pub.publicUrl,
    };
  });

export const getSignedDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bucket: string; path: string }) =>
    z.object({ bucket: z.string(), path: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 600);
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "resource_downloaded",
      target: data.path,
      metadata: { bucket: data.bucket },
    });
    return { url: signed.signedUrl };
  });

export const publishCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) =>
    z.object({ courseId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("publish_course", { _course_id: data.courseId });
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "course_published",
      target: data.courseId,
    });
    return { ok: true };
  });

export const unpublishCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) =>
    z.object({ courseId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("unpublish_course", { _course_id: data.courseId });
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "course_unpublished",
      target: data.courseId,
    });
    return { ok: true };
  });

export const createQuizInline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { courseId: string; lessonId?: string | null; title: string; passPercent?: number }) =>
      z
        .object({
          courseId: z.string().uuid(),
          lessonId: z.string().uuid().nullable().optional(),
          title: z.string().trim().min(1).max(200),
          passPercent: z.number().int().min(1).max(100).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("quizzes")
      .insert({
        course_id: data.courseId,
        lesson_id: data.lessonId ?? null,
        title: data.title,
        pass_percent: data.passPercent ?? 70,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const attachQuizToLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quizId: string; lessonId: string | null }) =>
    z.object({ quizId: z.string().uuid(), lessonId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("quizzes").update({ lesson_id: data.lessonId }).eq("id", data.quizId);
    return { ok: true };
  });

export const upsertAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      course_id: string;
      lesson_id?: string | null;
      title: string;
      instructions?: string;
      rubric?: string;
      due_at?: string | null;
      allow_late?: boolean;
      max_score?: number;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          course_id: z.string().uuid(),
          lesson_id: z.string().uuid().nullable().optional(),
          title: z.string().trim().min(2).max(200),
          instructions: z.string().max(8000).optional(),
          rubric: z.string().max(8000).optional(),
          due_at: z.string().nullable().optional(),
          allow_late: z.boolean().optional(),
          max_score: z.number().int().min(1).max(1000).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      course_id: data.course_id,
      lesson_id: data.lesson_id ?? null,
      title: data.title,
      instructions: data.instructions ?? null,
      rubric: data.rubric ?? null,
      due_at: data.due_at ?? null,
      allow_late: data.allow_late ?? true,
      max_score: data.max_score ?? 100,
    };
    if (data.id) {
      await supabaseAdmin.from("assignments").update(payload).eq("id", data.id);
      await logAudit({
        actorId: context.userId,
        actorEmail: actorEmail(context),
        action: "assignment_updated",
        target: data.id,
        metadata: { title: data.title, courseId: data.course_id },
      });
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("assignments")
      .insert({
        ...payload,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "assignment_created",
      target: row.id,
      metadata: { title: data.title, courseId: data.course_id },
    });
    return { id: row.id };
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("assignments").delete().eq("id", data.id);
    await logAudit({
      actorId: context.userId,
      actorEmail: actorEmail(context),
      action: "assignment_deleted",
      target: data.id,
    });
    return { ok: true };
  });
