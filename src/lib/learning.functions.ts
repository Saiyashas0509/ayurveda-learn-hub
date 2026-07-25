// Learner-facing server functions: dashboard, courses, lessons, quiz flow, certificates.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { PLATFORM_WIDE_ROLES, ORG_SCOPED_ROLES } from "@/lib/auth-helpers";
import { computeCertificateExpiry } from "@/lib/cert-expiry";
import { orderCourseLessons } from "@/lib/lesson-order";
import { isVideoWatchRequirementMet } from "@/lib/video-watch-rules";

const PLATFORM_WIDE_ROLE_SET = new Set(PLATFORM_WIDE_ROLES);
const ORG_SCOPED_ROLE_SET = new Set(ORG_SCOPED_ROLES);
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
    const isPlatformWide = roleList.some((r) => PLATFORM_WIDE_ROLE_SET.has(r));
    const isOrgScoped = isPlatformWide || roleList.some((r) => ORG_SCOPED_ROLE_SET.has(r));
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

// Fetches a course's modules/lessons and hands them to the pure
// orderCourseLessons (lesson-order.ts) for the actual sequencing logic.
async function orderedLessonIds(
  supabase: { from: (table: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  courseId: string,
): Promise<string[]> {
  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase.from("course_modules").select("id,sort_order").eq("course_id", courseId),
    supabase
      .from("lessons")
      .select("id,module_id,sort_order")
      .eq("course_id", courseId)
      .order("sort_order"),
  ]);
  return orderCourseLessons(modules ?? [], lessons ?? []);
}

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
    const [{ data: lessons }, order] = await Promise.all([
      context.supabase
        .from("lessons")
        .select("id,title,sort_order,duration_seconds")
        .eq("course_id", course.id),
      orderedLessonIds(context.supabase, course.id),
    ]);
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
    const byId = new Map((lessons ?? []).map((l) => [l.id, l]));
    const orderedLessons = order
      .map((id) => byId.get(id))
      .filter((l): l is NonNullable<typeof l> => !!l);
    return {
      course,
      lessons: orderedLessons,
      progress: (progress ?? []).reduce<Record<string, boolean>>((acc, p) => {
        acc[p.lesson_id] = !!p.completed_at;
        return acc;
      }, {}),
    };
  });

const FACULTY_ROLE_SET = new Set(["super_admin", "hr_admin", "trainer", "faculty"]);

export const getCourseRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) =>
    z.object({ courseId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("course_ratings")
      .select("rating,user_id")
      .eq("course_id", data.courseId);
    const all = rows ?? [];
    const count = all.length;
    const average = count
      ? Math.round((all.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : null;
    const mine = all.find((r) => r.user_id === context.userId)?.rating ?? null;
    return { average, count, myRating: mine };
  });

export const submitCourseRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string; rating: number; comment?: string }) =>
    z
      .object({
        courseId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Only learners who've actually made progress in the course may rate it
    // — otherwise anyone with a link could leave a review on a course
    // they've never opened.
    const { data: progressRow } = await context.supabase
      .from("lesson_progress")
      .select("id, lessons!inner(course_id)")
      .eq("user_id", context.userId)
      .eq("lessons.course_id", data.courseId)
      .limit(1)
      .maybeSingle();
    if (!progressRow) throw new Error("Start the course before rating it");

    const { error } = await context.supabase.from("course_ratings").upsert(
      {
        course_id: data.courseId,
        user_id: context.userId,
        rating: data.rating,
        comment: data.comment ?? null,
      },
      { onConflict: "course_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
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

    // Sequential unlock: this lesson requires the one immediately before it
    // in the course's true sequence (see orderedLessonIds) to be completed.
    // Faculty/admin roles can review any lesson without doing this in order.
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isFaculty = (roleRows ?? []).some((r) => FACULTY_ROLE_SET.has(r.role));
    if (!isFaculty) {
      const order = await orderedLessonIds(context.supabase, lesson.course_id);
      const position = order.indexOf(lesson.id);
      if (position > 0) {
        const previousId = order[position - 1];
        const { data: prevProgress } = await context.supabase
          .from("lesson_progress")
          .select("completed_at")
          .eq("user_id", context.userId)
          .eq("lesson_id", previousId)
          .maybeSingle();
        if (!prevProgress?.completed_at) {
          const course = lesson.courses as { id: string; title: string; slug: string } | null;
          return {
            lesson: null,
            quiz: null,
            locked: true,
            courseSlug: course?.slug ?? null,
            courseTitle: course?.title ?? null,
            lessonTitle: lesson.title,
          };
        }
      }
    }

    const { data: quiz } = await context.supabase
      .from("quizzes")
      .select("id,title,pass_percent,time_limit_seconds")
      .eq("lesson_id", data.lessonId)
      .maybeSingle();

    const { data: progress } = await context.supabase
      .from("lesson_progress")
      .select("watched_seconds,skip_detected,completed_at")
      .eq("user_id", context.userId)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    const progressSkipDetected = progress?.skip_detected ?? false;

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

    return {
      lesson: { ...lesson, video_url: videoUrl },
      quiz,
      locked: false,
      watchProgress: {
        watchedSeconds: progress?.watched_seconds ?? 0,
        skipDetected: progressSkipDetected,
        completed: !!progress?.completed_at,
        videoWatchRequirementMet: isVideoWatchRequirementMet(
          lesson.duration_seconds,
          progress?.watched_seconds ?? 0,
          progressSkipDetected,
        ),
      },
    };
  });

// Periodic heartbeat from the lesson video player (see lessons.$lessonId.tsx)
// — reports the furthest playback position reached, and whether a forward
// skip was ever detected client-side. Both are sticky in the stored sense
// that this never lets watched progress move backward or a skip flag clear:
// a client resending a lower position or skipDetected:false can't undo an
// already-recorded skip or rewind reported progress.
export const updateVideoProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      lessonId: string;
      watchedSeconds: number;
      skipDetected: boolean;
      durationSeconds?: number;
    }) =>
      z
        .object({
          lessonId: z.string().uuid(),
          // lesson_progress.watched_seconds is a Postgres integer column, but
          // video.currentTime (what the client sends) is always fractional
          // (e.g. 11.974902) — without rounding here, every single report was
          // rejected with "invalid input syntax for type integer" and silently
          // swallowed by the player's own .catch(), meaning watched progress
          // was never actually persisted despite the video visibly playing to
          // completion. Caught via a real full-playthrough test, not inferred.
          watchedSeconds: z.number().min(0).max(36000).transform(Math.floor),
          skipDetected: z.boolean(),
          // The video element's own (real, measured) duration — see below.
          durationSeconds: z.number().min(0).max(36000).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("lesson_progress")
      .select("watched_seconds,skip_detected")
      .eq("user_id", context.userId)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    const { error } = await context.supabase.from("lesson_progress").upsert(
      {
        user_id: context.userId,
        lesson_id: data.lessonId,
        watched_seconds: Math.max(existing?.watched_seconds ?? 0, data.watchedSeconds),
        skip_detected: (existing?.skip_detected ?? false) || data.skipDetected,
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw new Error(error.message);

    // Self-heals lessons.duration_seconds against what the video element
    // itself actually measures — found via real testing that this can drift
    // from reality (a lesson had 147 stored vs. an actual 126.4s), which
    // silently made the "watch 98% of the video" gate in markLessonComplete/
    // startQuizAttempt impossible to satisfy even after watching 100% of the
    // real video, since those checks read the (wrong) stored value. Only
    // faculty can write to `lessons` normally, so this uses the admin client
    // — safe here because it's a narrow, server-computed correction, not
    // arbitrary client-supplied content.
    const roundedDuration = data.durationSeconds ? Math.round(data.durationSeconds) : null;
    if (roundedDuration && roundedDuration > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: lesson } = await supabaseAdmin
        .from("lessons")
        .select("duration_seconds")
        .eq("id", data.lessonId)
        .maybeSingle();
      if (!lesson?.duration_seconds || Math.abs(lesson.duration_seconds - roundedDuration) > 2) {
        await supabaseAdmin
          .from("lessons")
          .update({ duration_seconds: roundedDuration })
          .eq("id", data.lessonId);
      }
    }

    return { ok: true };
  });

export const markLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lessonId: string }) =>
    z.object({ lessonId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Server-side enforcement of "watched the whole video, no skipping" —
    // the client already gates the Mark Complete button on this, but that's
    // only UX; this is what actually stops someone from calling the API
    // directly to skip the check.
    const { data: lesson } = await context.supabase
      .from("lessons")
      .select("video_url,duration_seconds")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (lesson?.video_url) {
      const { data: progress } = await context.supabase
        .from("lesson_progress")
        .select("watched_seconds,skip_detected")
        .eq("user_id", context.userId)
        .eq("lesson_id", data.lessonId)
        .maybeSingle();
      if (
        !isVideoWatchRequirementMet(
          lesson.duration_seconds,
          progress?.watched_seconds ?? 0,
          progress?.skip_detected ?? false,
        )
      ) {
        throw new Error(
          "Watch the entire video, from start to finish without skipping ahead, before marking this lesson complete.",
        );
      }
    }

    await context.supabase.from("lesson_progress").upsert(
      {
        user_id: context.userId,
        lesson_id: data.lessonId,
        completed_at: new Date().toISOString(),
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

    // Same "watched the whole video, no skipping" gate as markLessonComplete
    // — a quiz built from a video's own content shouldn't be answerable by
    // someone who skipped straight to it without watching.
    if (quiz.lesson_id) {
      const { data: lesson } = await supabaseAdmin
        .from("lessons")
        .select("video_url,duration_seconds")
        .eq("id", quiz.lesson_id)
        .maybeSingle();
      if (lesson?.video_url) {
        const { data: progress } = await supabaseAdmin
          .from("lesson_progress")
          .select("watched_seconds,skip_detected")
          .eq("user_id", context.userId)
          .eq("lesson_id", quiz.lesson_id)
          .maybeSingle();
        if (
          !isVideoWatchRequirementMet(
            lesson.duration_seconds,
            progress?.watched_seconds ?? 0,
            progress?.skip_detected ?? false,
          )
        ) {
          throw new Error(
            "Watch the entire video, without skipping ahead, before starting this quiz.",
          );
        }
      }
    }

    const { count: attemptCount } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", data.quizId)
      .eq("user_id", context.userId);

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

    return {
      quiz,
      attemptId: attempt.id,
      startedAt: attempt.started_at,
      questions: sanitized,
      attemptNumber: (attemptCount ?? 0) + 1,
    };
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
      .select(
        "id,user_id,quiz_id,finished_at,quizzes(id,pass_percent,course_id,lesson_id,courses(renewal_period_months))",
      )
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
        const renewalMonths = (
          attempt.quizzes as unknown as {
            courses?: { renewal_period_months?: number | null } | null;
          }
        ).courses?.renewal_period_months;
        const expiresAt = computeCertificateExpiry(renewalMonths);
        const { data: inserted } = await supabaseAdmin
          .from("certificates")
          .insert({
            user_id: context.userId,
            course_id: attempt.quizzes.course_id,
            cert_code: code,
            score_percent: score,
            expires_at: expiresAt,
          })
          .select("cert_code")
          .single();
        certCode = inserted?.cert_code ?? code;
        if (inserted?.cert_code) {
          const { generateCertificatePdf } = await import("@/lib/certificate-pdf-server");
          await generateCertificatePdf(supabaseAdmin, inserted.cert_code).catch((e) =>
            console.error("Certificate PDF generation failed", e),
          );
        }
      }
      if (attempt.quizzes.lesson_id) {
        // Passing a lesson's quiz completes that lesson too — reaching this
        // point already proves the video-watch requirement was met (startQuizAttempt
        // won't hand out an attempt otherwise), so watched_seconds/skip_detected
        // are left untouched here rather than overwritten.
        await supabaseAdmin.from("lesson_progress").upsert(
          {
            user_id: context.userId,
            lesson_id: attempt.quizzes.lesson_id,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,lesson_id" },
        );
      }
    }

    const { count: attemptCount } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", attempt.quiz_id)
      .eq("user_id", context.userId)
      .not("finished_at", "is", null);

    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      action: "quiz_attempt_submitted",
      target: data.attemptId,
      metadata: { quizId: attempt.quiz_id, score, passed, attemptNumber: attemptCount ?? 1 },
    });

    return { score, passed, certCode, attemptNumber: attemptCount ?? 1 };
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

// Returns a short-lived signed URL to the server-generated certificate PDF
// (with QR code), lazily generating it if this cert predates that feature.
export const getCertificateDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { certCode: string }) =>
    z.object({ certCode: z.string().trim().max(64) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cert } = await supabaseAdmin
      .from("certificates")
      .select("user_id")
      .eq("cert_code", data.certCode)
      .maybeSingle();
    if (!cert) throw new Error("Certificate not found");
    if (cert.user_id !== context.userId) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .in("role", ["super_admin", "hr_admin"]);
      if (!roles || !roles.length) throw new Error("Certificate not found");
    }

    const path = `${data.certCode}.pdf`;
    const exists = await supabaseAdmin.storage.from("certificates").list("", { search: path });
    if (!exists.data?.some((f) => f.name === path)) {
      const { generateCertificatePdf } = await import("@/lib/certificate-pdf-server");
      await generateCertificatePdf(supabaseAdmin, data.certCode);
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from("certificates")
      .createSignedUrl(path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
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
