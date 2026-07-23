// Assignments: students view/submit, faculty grade.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const FACULTY_ROLES = ["super_admin", "hr_admin", "trainer", "faculty"] as const;

async function isFaculty(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...FACULTY_ROLES]);
  return !!(data && data.length);
}

export const listMyAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: assignments } = await context.supabase
      .from("assignments")
      .select("id,title,due_at,max_score,allow_late,courses(title,slug),lessons(title)")
      .order("due_at", { ascending: true, nullsFirst: false });
    const { data: subs } = await context.supabase
      .from("assignment_submissions")
      .select("assignment_id,status,grade,submitted_at,is_late")
      .eq("user_id", context.userId);
    const byId = new Map((subs ?? []).map((s) => [s.assignment_id, s]));
    return (assignments ?? []).map((a) => ({ ...a, submission: byId.get(a.id) ?? null }));
  });

export const getAssignment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: assignment } = await context.supabase
      .from("assignments")
      .select("*,courses(title,slug),lessons(title)")
      .eq("id", data.id)
      .maybeSingle();
    if (!assignment) throw new Error("Assignment not found");
    const { data: submission } = await context.supabase
      .from("assignment_submissions")
      .select("*")
      .eq("assignment_id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { assignment, submission };
  });

export const submitAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { assignmentId: string; fileUrl: string; fileName: string; fileKind: string }) =>
      z
        .object({
          assignmentId: z.string().uuid(),
          fileUrl: z.string().max(1000),
          fileName: z.string().max(300),
          fileKind: z.string().max(50),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin
      .from("assignments")
      .select("due_at,allow_late")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (!a) throw new Error("Assignment not found");
    const now = new Date();
    const isLate = a.due_at ? now > new Date(a.due_at) : false;
    if (isLate && !a.allow_late) throw new Error("Late submissions are not allowed");
    const { error } = await supabaseAdmin.from("assignment_submissions").upsert(
      {
        assignment_id: data.assignmentId,
        user_id: context.userId,
        file_url: data.fileUrl,
        file_name: data.fileName,
        file_kind: data.fileKind,
        submitted_at: now.toISOString(),
        is_late: isLate,
        status: "submitted",
        grade: null,
        feedback: null,
        graded_at: null,
        graded_by: null,
      },
      { onConflict: "assignment_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, isLate };
  });

export const listSubmissionsForGrading = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      assignmentId?: string;
      status?: "all" | "submitted" | "graded";
      search?: string;
      page?: number;
      pageSize?: number;
    }) =>
      z
        .object({
          assignmentId: z.string().uuid().optional(),
          status: z.enum(["all", "submitted", "graded"]).default("all"),
          search: z.string().trim().max(200).optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(20),
        })
        .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!(await isFaculty(context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("assignment_submissions")
      .select(
        "*,assignments(title,max_score,rubric,courses(title)),employees!assignment_submissions_user_id_fkey(full_name,email)",
        { count: "exact" },
      )
      .order("submitted_at", { ascending: false });
    if (data.assignmentId) q = q.eq("assignment_id", data.assignmentId);
    if (data.status !== "all") q = q.eq("status", data.status);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // Name/email search filtered post-fetch (joined table); fine at admin panel scale.
    const s = data.search?.trim().toLowerCase();
    const filtered = s
      ? (rows ?? []).filter((r) => {
          const emp = r.employees as { full_name?: string; email?: string } | null;
          return emp?.full_name?.toLowerCase().includes(s) || emp?.email?.toLowerCase().includes(s);
        })
      : (rows ?? []);

    const { data: assignments } = await supabaseAdmin
      .from("assignments")
      .select("id,title,courses(title)")
      .order("created_at", { ascending: false });

    // Stats reflect the current assignment/status scope, not just this page.
    let statsQ = supabaseAdmin
      .from("assignment_submissions")
      .select("status,grade", { count: "exact" });
    if (data.assignmentId) statsQ = statsQ.eq("assignment_id", data.assignmentId);
    const { data: statsRows } = await statsQ;
    const total = statsRows?.length ?? 0;
    const graded = statsRows?.filter((r) => r.status === "graded") ?? [];
    const avgGrade = graded.length
      ? Math.round((graded.reduce((sum, r) => sum + (r.grade ?? 0), 0) / graded.length) * 10) / 10
      : null;

    return {
      submissions: filtered,
      assignments: assignments ?? [],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / data.pageSize)),
      stats: {
        total,
        pending: total - graded.length,
        graded: graded.length,
        avgGrade,
      },
    };
  });

export const gradeSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string; grade: number; feedback?: string }) =>
    z
      .object({
        submissionId: z.string().uuid(),
        grade: z.number().min(0).max(1000),
        feedback: z.string().max(4000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!(await isFaculty(context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("assignment_submissions")
      .update({
        grade: data.grade,
        feedback: data.feedback ?? null,
        graded_by: context.userId,
        graded_at: new Date().toISOString(),
        status: "graded",
      })
      .eq("id", data.submissionId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "assignment_graded",
      target: data.submissionId,
      metadata: { grade: data.grade },
    });
    return { ok: true };
  });
