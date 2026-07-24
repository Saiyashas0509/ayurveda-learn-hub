// Learner-facing server functions: dashboard, courses, lessons, quiz flow, certificates.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

// Roles whose dashboard shows org/team-level stats (orgMembers, orgCompletions,
// pendingReviews) rather than just personal learning progress — see roleViews.ts.
const PLATFORM_WIDE_ROLES = new Set(["super_admin", "hr_admin"]);
const ORG_SCOPED_ROLES = new Set([
  "org_admin",
  "franchise_owner",
  "regional_manager",
  "center_head_doctor",
  "doctor",
  "faculty",
  "trainer",
]);
const REVIEWER_ROLES = new Set(["doctor", "faculty", "trainer"]);

export const getMyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [employee, roles, progress, certs, announcements, courses] = await Promise.all([
      supabase
        .from("employees")
        .select(
          "full_name,email,designation,center_id,primary_role,organization_id,centers(name),organizations(name,org_type)",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("lesson_progress")
        .select("id,completed_at,lesson_id,lessons(course_id,title)")
        .eq("user_id", userId),
      supabase
        .from("certificates")
        .select("id,cert_code,issued_at,courses(title)")
        .eq("user_id", userId)
        .order("issued_at", { ascending: false })
        .limit(5),
      supabase
        .from("announcements")
        .select("id,title,body,published_at")
        .order("published_at", { ascending: false })
        .limit(5),
      supabase.from("courses").select("id,title,slug,cover_url").eq("is_published", true).limit(6),
    ]);

    const completedLessonIds = new Set(
      (progress.data ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id),
    );
    const pendingCount = (progress.data ?? []).length - completedLessonIds.size;

    const roleList = (roles.data ?? []).map((r) => r.role);
    const isPlatformWide = roleList.some((r) => PLATFORM_WIDE_ROLES.has(r));
    const isOrgScoped = isPlatformWide || roleList.some((r) => ORG_SCOPED_ROLES.has(r));
    const orgId = employee.data?.organization_id ?? null;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let orgMembers = 0;
    let orgCompletions = 0;
    let pendingReviews = 0;

    if (isPlatformWide) {
      const [membersRes, certsThisMonth] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase
          .from("certificates")
          .select("id", { count: "exact", head: true })
          .gte("issued_at", monthStart.toISOString()),
      ]);
      orgMembers = membersRes.count ?? 0;
      orgCompletions = certsThisMonth.count ?? 0;
    } else if (isOrgScoped && orgId) {
      // certificates.user_id references auth.users, not employees — no FK for
      // PostgREST to embed on. Resolve org membership as its own step instead.
      const { data: orgEmployeeRows, count: membersCount } = await supabase
        .from("employees")
        .select("id", { count: "exact" })
        .eq("organization_id", orgId);
      const orgEmployeeIds = (orgEmployeeRows ?? []).map((e) => e.id);
      const { count: certsCount } = orgEmployeeIds.length
        ? await supabase
            .from("certificates")
            .select("id", { count: "exact", head: true })
            .in("user_id", orgEmployeeIds)
            .gte("issued_at", monthStart.toISOString())
        : { count: 0 };
      orgMembers = membersCount ?? 0;
      orgCompletions = certsCount ?? 0;
    }

    if (roleList.some((r) => REVIEWER_ROLES.has(r))) {
      const { count } = await supabase
        .from("assignment_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted");
      pendingReviews = count ?? 0;
    }

    return {
      employee: employee.data,
      roles: roleList,
      completedCount: completedLessonIds.size,
      pendingCount,
      certificates: certs.data ?? [],
      announcements: announcements.data ?? [],
      courses: courses.data ?? [],
      orgMembers,
      orgCompletions,
      pendingReviews,
    };
  });

export const listCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: courses } = await context.supabase
      .from("courses")
      .select("id,title,slug,description,cover_url,duration_minutes")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    return { courses: courses ?? [] };
  });

export const getCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: course } = await context.supabase
      .from("courses")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course) throw new Error("Course not found");
    const { data: lessons } = await context.supabase
      .from("lessons")
      .select("id,title,sort_order,duration_seconds")
      .eq("course_id", course.id)
      .order("sort_order");
    const { data: progress } = await context.supabase
      .from("lesson_progress")
      .select("lesson_id,completed_at")
      .eq("user_id", context.userId);
    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "course_viewed",
      target: course.id,
      metadata: { title: course.title },
    });
    return {
      course,
      lessons: lessons ?? [],
      progress: (progress ?? []).reduce<Record<string, boolean>>((acc, p) => {
        acc[p.lesson_id] = !!p.completed_at;
        return acc;
      }, {}),
    };
  });

export const getLesson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lessonId: string }) =>
    z.object({ lessonId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase
      .from("lessons")
      .select("*,courses(id,title,slug)")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");
    const { data: quiz } = await context.supabase
      .from("quizzes")
      .select("id,title,pass_percent,time_limit_seconds")
      .eq("lesson_id", data.lessonId)
      .maybeSingle();

    // Never hand the real (Hostinger) video URL to the client — mint a
    // short-lived signed token for the proxy route instead. Reaching this
    // point already proves the caller passed RLS on `lessons`, so no extra
    // authorization check is needed here.
    let videoUrl: string | null = null;
    if (lesson.video_url) {
      const secret = process.env.MEDIA_SIGNING_SECRET;
      if (secret) {
        const { signMediaToken } = await import("@/lib/media-token");
        const { exp, sig } = await signMediaToken(lesson.id, secret);
        videoUrl = `/media/lessons/${lesson.id}?exp=${exp}&sig=${sig}`;
      }
    }

    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "lesson_viewed",
      target: lesson.id,
      metadata: { title: lesson.title, courseId: lesson.course_id },
    });

    return { lesson: { ...lesson, video_url: videoUrl }, quiz };
  });

export const markLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lessonId: string }) =>
    z.object({ lessonId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("lesson_progress").upsert(
      {
        user_id: context.userId,
        lesson_id: data.lessonId,
        completed_at: new Date().toISOString(),
        watched_seconds: 0,
      },
      { onConflict: "user_id,lesson_id" },
    );
    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "lesson_completed",
      target: data.lessonId,
    });
    return { ok: true };
  });

// Start a quiz attempt and return sanitized questions (no is_correct field).
export const startQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quizId: string }) => z.object({ quizId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("*")
      .eq("id", data.quizId)
      .maybeSingle();
    if (!quiz) throw new Error("Quiz not found");

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id,type,prompt,image_url,points,question_options(id,option_text,sort_order)")
      .eq("quiz_id", data.quizId)
      .order("sort_order");

    const sanitized = (questions ?? []).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      image_url: q.image_url,
      points: q.points,
      options: (q.question_options ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => ({ id: o.id, text: o.option_text })),
    }));

    if (quiz.randomize) sanitized.sort(() => Math.random() - 0.5);

    const { data: attempt, error } = await supabaseAdmin
      .from("quiz_attempts")
      .insert({ quiz_id: data.quizId, user_id: context.userId })
      .select("id,started_at")
      .single();
    if (error) throw new Error(error.message);

    return { quiz, attemptId: attempt.id, startedAt: attempt.started_at, questions: sanitized };
  });

export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { attemptId: string; answers: { questionId: string; optionId: string | null }[] }) =>
      z
        .object({
          attemptId: z.string().uuid(),
          answers: z
            .array(
              z.object({ questionId: z.string().uuid(), optionId: z.string().uuid().nullable() }),
            )
            .max(200),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: attempt } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id,user_id,quiz_id,finished_at,quizzes(id,pass_percent,course_id,lesson_id)")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (!attempt || attempt.user_id !== context.userId) throw new Error("Attempt not found");
    if (attempt.finished_at) throw new Error("Attempt already submitted");

    const questionIds = data.answers.map((a) => a.questionId);
    const { data: correctOptions } = await supabaseAdmin
      .from("question_options")
      .select("id,question_id,is_correct")
      .in("question_id", questionIds);
    const correctByQ = new Map<string, string>();
    (correctOptions ?? []).forEach((o) => {
      if (o.is_correct) correctByQ.set(o.question_id, o.id);
    });

    let correct = 0;
    const rows = data.answers.map((a) => {
      const isCorrect = correctByQ.get(a.questionId) === a.optionId;
      if (isCorrect) correct++;
      return {
        attempt_id: data.attemptId,
        question_id: a.questionId,
        selected_option_id: a.optionId,
        is_correct: isCorrect,
      };
    });
    if (rows.length) await supabaseAdmin.from("attempt_answers").insert(rows);

    const total = data.answers.length || 1;
    const score = Math.round((correct / total) * 10000) / 100;
    const passed = score >= (attempt.quizzes?.pass_percent ?? 70);

    await supabaseAdmin
      .from("quiz_attempts")
      .update({ finished_at: new Date().toISOString(), score_percent: score, passed })
      .eq("id", data.attemptId);

    let certCode: string | null = null;
    if (passed && attempt.quizzes?.course_id) {
      // Issue certificate if not already
      const { data: existing } = await supabaseAdmin
        .from("certificates")
        .select("id,cert_code")
        .eq("user_id", context.userId)
        .eq("course_id", attempt.quizzes.course_id)
        .maybeSingle();
      if (existing) {
        certCode = existing.cert_code;
      } else {
        const code = `TA-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const { data: inserted } = await supabaseAdmin
          .from("certificates")
          .insert({
            user_id: context.userId,
            course_id: attempt.quizzes.course_id,
            cert_code: code,
            score_percent: score,
          })
          .select("cert_code")
          .single();
        certCode = inserted?.cert_code ?? code;
      }
      if (attempt.quizzes.lesson_id) {
        await supabaseAdmin.from("lesson_progress").upsert(
          {
            user_id: context.userId,
            lesson_id: attempt.quizzes.lesson_id,
            completed_at: new Date().toISOString(),
            watched_seconds: 0,
          },
          { onConflict: "user_id,lesson_id" },
        );
      }
    }

    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "quiz_attempt_submitted",
      target: data.attemptId,
      metadata: { quizId: attempt.quiz_id, score, passed },
    });

    return { score, passed, certCode };
  });

export const listMyCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("certificates")
      .select("id,cert_code,issued_at,score_percent,courses(title,slug)")
      .eq("user_id", context.userId)
      .order("issued_at", { ascending: false });
    return data ?? [];
  });

// Public: verify a certificate by code (no auth required).
// Anonymous users have no direct read access to certificates; this server
// function projects only non-sensitive verification fields (no score, no
// expiry, no user_id) using the service-role client.
export const verifyCertificate = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) =>
    z.object({ code: z.string().trim().max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("certificates")
      .select("cert_code,issued_at,user_id,courses(title)")
      .eq("cert_code", data.code)
      .maybeSingle();
    if (!row) return { cert: null };

    // certificates.user_id references auth.users, not employees — no FK for
    // PostgREST to embed on. Fetch the employee record as a separate step.
    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("full_name,centers(name)")
      .eq("id", row.user_id)
      .maybeSingle();

    return {
      cert: {
        cert_code: row.cert_code,
        issued_at: row.issued_at,
        courses: row.courses,
        employees: employee,
      },
    };
  });
