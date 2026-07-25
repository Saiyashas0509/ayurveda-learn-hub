// Exportable admin reports: learner progress, attendance, org stats +
// trainer ratings, and audit/compliance logs. Returns plain rows; the client
// turns them into Excel (xlsx) or PDF (jspdf-autotable) — see
// src/lib/report-export.ts and src/routes/_authenticated/admin/reports.tsx.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ORG_SCOPED_REPORTING_ROLES as ORG_SCOPED_ROLES,
  PLATFORM_WIDE_REPORTING_ROLES as PLATFORM_ROLES,
} from "@/lib/org-scope-roles";

const MAX_ROWS = 5000;

async function resolveScope(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: roleRows }, { data: employee }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("employees").select("organization_id").eq("id", userId).maybeSingle(),
  ]);
  const roleList = (roleRows ?? []).map((r) => r.role);
  const isPlatformWide = roleList.some((r) => PLATFORM_ROLES.has(r));
  const isOrgScoped = roleList.some((r) => ORG_SCOPED_ROLES.has(r));
  if (!isPlatformWide && !isOrgScoped) throw new Error("Forbidden: admin role required");
  return { isPlatformWide, orgId: employee?.organization_id ?? null };
}

export const getLearnerProgressReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isPlatformWide, orgId } = await resolveScope(context.userId);

    let q = supabaseAdmin
      .from("employees")
      .select("id,full_name,email,status,centers(name),organizations(name)")
      .order("full_name")
      .limit(MAX_ROWS);
    if (!isPlatformWide) {
      if (!orgId) return [];
      q = q.eq("organization_id", orgId);
    }
    const { data: employees, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (employees ?? []).map((e) => e.id);
    if (!ids.length) return [];

    const [{ data: progress }, { data: certs }] = await Promise.all([
      supabaseAdmin.from("lesson_progress").select("user_id,completed_at").in("user_id", ids),
      supabaseAdmin.from("certificates").select("user_id").in("user_id", ids),
    ]);

    const startedByUser = new Map<string, number>();
    const completedByUser = new Map<string, number>();
    for (const p of progress ?? []) {
      startedByUser.set(p.user_id, (startedByUser.get(p.user_id) ?? 0) + 1);
      if (p.completed_at) completedByUser.set(p.user_id, (completedByUser.get(p.user_id) ?? 0) + 1);
    }
    const certsByUser = new Map<string, number>();
    for (const c of certs ?? []) certsByUser.set(c.user_id, (certsByUser.get(c.user_id) ?? 0) + 1);

    return (employees ?? []).map((e) => ({
      name: e.full_name,
      email: e.email,
      status: e.status,
      center: (e.centers as { name?: string } | null)?.name ?? "—",
      organization: (e.organizations as { name?: string } | null)?.name ?? "—",
      lessonsStarted: startedByUser.get(e.id) ?? 0,
      lessonsCompleted: completedByUser.get(e.id) ?? 0,
      certificatesEarned: certsByUser.get(e.id) ?? 0,
    }));
  });

export const getAttendanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isPlatformWide, orgId } = await resolveScope(context.userId);

    const { data: classes, error } = await supabaseAdmin
      .from("live_classes")
      .select("id,title,starts_at,courses(title)")
      .order("starts_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const classIds = (classes ?? []).map((c) => c.id);
    if (!classIds.length) return [];

    const { data: attendance } = await supabaseAdmin
      .from("live_class_attendance")
      .select("live_class_id,user_id,joined_at")
      .in("live_class_id", classIds)
      .limit(MAX_ROWS);

    const userIds = [...new Set((attendance ?? []).map((a) => a.user_id))];
    const { data: employeeRows } = userIds.length
      ? await supabaseAdmin
          .from("employees")
          .select("id,full_name,email,organization_id")
          .in("id", userIds)
      : {
          data: [] as {
            id: string;
            full_name: string;
            email: string;
            organization_id: string | null;
          }[],
        };
    const employeeById = new Map((employeeRows ?? []).map((e) => [e.id, e]));
    const classById = new Map((classes ?? []).map((c) => [c.id, c]));

    return (attendance ?? [])
      .map((a) => {
        const emp = employeeById.get(a.user_id);
        if (!isPlatformWide && emp?.organization_id !== orgId) return null;
        const cls = classById.get(a.live_class_id);
        return {
          class: cls?.title ?? "—",
          course: (cls?.courses as { title?: string } | null)?.title ?? "—",
          date: cls?.starts_at ?? "",
          attendee: emp?.full_name ?? "Unknown",
          email: emp?.email ?? "—",
          clickedJoinAt: a.joined_at,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  });

export const getOrgStatsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isPlatformWide, orgId } = await resolveScope(context.userId);

    let orgsQ = supabaseAdmin.from("organizations").select("id,name,org_type").order("name");
    if (!isPlatformWide) {
      if (!orgId) return { orgs: [], trainers: [] };
      orgsQ = orgsQ.eq("id", orgId);
    }
    const { data: orgs, error } = await orgsQ;
    if (error) throw new Error(error.message);

    const rows = await Promise.all(
      (orgs ?? []).map(async (org) => {
        const [{ count: members }, { data: memberIds }] = await Promise.all([
          supabaseAdmin
            .from("employees")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id),
          supabaseAdmin.from("employees").select("id").eq("organization_id", org.id),
        ]);
        const ids = (memberIds ?? []).map((m) => m.id);
        const { count: certs } = ids.length
          ? await supabaseAdmin
              .from("certificates")
              .select("id", { count: "exact", head: true })
              .in("user_id", ids)
          : { count: 0 };
        return {
          organization: org.name,
          type: org.org_type,
          members: members ?? 0,
          certificatesIssued: certs ?? 0,
        };
      }),
    );

    // Trainer ratings (from the trainer_ratings view) — platform admins see
    // everyone; org-scoped admins only see trainers whose authored courses
    // belong to their own org.
    const { data: ratingRows } = await supabaseAdmin
      .from("trainer_ratings")
      .select("trainer_id,rating_count,avg_rating");
    const trainerIds = (ratingRows ?? [])
      .map((r) => r.trainer_id)
      .filter((id): id is string => !!id);
    const { data: trainerEmployees } = trainerIds.length
      ? await supabaseAdmin
          .from("employees")
          .select("id,full_name,organization_id")
          .in("id", trainerIds)
      : { data: [] as { id: string; full_name: string; organization_id: string | null }[] };
    const trainerById = new Map((trainerEmployees ?? []).map((t) => [t.id, t]));

    const trainers = (ratingRows ?? [])
      .map((r) => {
        const trainer = r.trainer_id ? trainerById.get(r.trainer_id) : null;
        if (!isPlatformWide && trainer?.organization_id !== orgId) return null;
        return {
          trainer: trainer?.full_name ?? "Unknown",
          ratingCount: r.rating_count ?? 0,
          avgRating: r.avg_rating ?? 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return { orgs: rows, trainers };
  });

export const getComplianceLogReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { days?: number }) =>
    z.object({ days: z.number().int().min(1).max(365).default(90) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isPlatformWide, orgId } = await resolveScope(context.userId);
    // Audit logs aren't org-tagged at the row level — restricting this to
    // platform-wide admins only (same as the raw audit-log viewer page)
    // rather than trying to approximate org scoping on a table that doesn't
    // actually carry that dimension.
    if (!isPlatformWide) {
      if (!orgId) return [];
      throw new Error("Compliance/audit log export requires a platform admin role");
    }
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("audit_logs")
      .select("created_at,actor_email,action,target,metadata")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      date: r.created_at,
      actor: r.actor_email ?? "system",
      action: r.action,
      target: r.target ?? "—",
      metadata: JSON.stringify(r.metadata ?? {}),
    }));
  });
