// Admin-only server functions: create employees, assign roles, disable users,
// publish announcements, read audit logs. All re-check role server-side.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ADMIN_ONLY_ROLES,
  PLATFORM_WIDE_ROLES,
  ORG_SCOPED_ROLES,
  type AppRole,
} from "@/lib/auth-helpers";
import { getSiteOrigin } from "@/lib/site-origin";
import { pairLoginSessions, type JsonMetadata } from "@/lib/login-sessions";

// Every role an admin can directly assign — kept as one list so the "New
// employee" form, CSV bulk import, and the role filter all agree on what's
// valid. Previously createEmployeeUser/setUserRole only accepted 8 of the 15
// roles even though their own dropdowns offered all 15, so picking e.g.
// "Doctor" or "Student" there always failed server-side.
const ASSIGNABLE_ROLE_ENUM = [
  "super_admin",
  "hr_admin",
  "regional_manager",
  "center_head_doctor",
  "front_office",
  "therapist",
  "trainer",
  "auditor",
  "student",
  "doctor",
  "franchise_owner",
  "corporate_employee",
  "hospital_staff",
  "faculty",
  "org_admin",
] as const satisfies readonly AppRole[];

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "hr_admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin role required");
}

// Admin roles sign in with a password, not OTP/Google (see /admin/login).
// Whenever someone is created or promoted into an admin role, send them a
// Supabase "reset password" email — the same email works as a first-time
// "set your password" link since the account has no password yet.
async function sendAdminPasswordSetupEmail(email: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const redirectTo = `${getSiteOrigin()}/admin/set-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) console.error(`[admin-password-setup] failed to email ${email}:`, error.message);
}

function isAdminRole(role: string): role is AppRole {
  return (ADMIN_ONLY_ROLES as string[]).includes(role);
}

export const createEmployeeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      email: string;
      fullName: string;
      role: string;
      centerId?: string | null;
      designation?: string;
      employeeCode?: string;
    }) => {
      return z
        .object({
          email: z.string().trim().toLowerCase().email().max(255),
          fullName: z.string().trim().min(2).max(120),
          role: z.enum(ASSIGNABLE_ROLE_ENUM),
          centerId: z.string().uuid().nullable().optional(),
          designation: z.string().max(120).optional(),
          employeeCode: z.string().max(40).optional(),
        })
        .parse(data);
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const userId = created.user!.id;

    await supabaseAdmin.from("employees").insert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      center_id: data.centerId ?? null,
      designation: data.designation ?? null,
      employee_code: data.employeeCode ?? null,
      status: "active",
      // Admin-created accounts skip the self-signup onboarding wizard —
      // the admin already supplied everything it would have collected.
      onboarding_completed_at: new Date().toISOString(),
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user_created",
      target: userId,
      metadata: { email: data.email, role: data.role },
    });
    if (isAdminRole(data.role)) {
      await sendAdminPasswordSetupEmail(data.email);
    }
    return { ok: true, userId };
  });

// Bulk version of createEmployeeUser for CSV import. Processes rows
// sequentially and keeps going past individual failures (bad role, unknown
// center, duplicate email) so one bad row in a 100-row file doesn't block the
// other 99 — each row's outcome is reported back for the admin to review.
export const bulkCreateEmployeeUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      rows: {
        email: string;
        fullName: string;
        role: string;
        centerName?: string;
        designation?: string;
        employeeCode?: string;
      }[];
    }) =>
      z
        .object({
          rows: z
            .array(
              z.object({
                email: z.string().trim().toLowerCase().max(255),
                fullName: z.string().trim().max(120),
                role: z.string().trim().toLowerCase(),
                centerName: z.string().trim().max(120).optional(),
                designation: z.string().trim().max(120).optional(),
                employeeCode: z.string().trim().max(40).optional(),
              }),
            )
            .min(1)
            .max(200),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: centers } = await supabaseAdmin.from("centers").select("id, name");
    const centerByName = new Map(
      (centers ?? []).map((c) => [c.name.trim().toLowerCase(), c.id as string]),
    );
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const results: { email: string; ok: boolean; error?: string }[] = [];

    for (const row of data.rows) {
      try {
        if (!row.email || !EMAIL_RE.test(row.email)) throw new Error("Invalid email");
        if (!row.fullName || row.fullName.length < 2) throw new Error("Missing full name");
        if (!(ASSIGNABLE_ROLE_ENUM as readonly string[]).includes(row.role)) {
          throw new Error(`Unknown role "${row.role}"`);
        }
        const role = row.role as AppRole;

        let centerId: string | null = null;
        if (row.centerName) {
          const match = centerByName.get(row.centerName.trim().toLowerCase());
          if (!match) throw new Error(`Unknown center "${row.centerName}"`);
          centerId = match;
        }

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: row.email,
          email_confirm: true,
          user_metadata: { full_name: row.fullName },
        });
        if (error) throw new Error(error.message);
        const userId = created.user!.id;

        await supabaseAdmin.from("employees").insert({
          id: userId,
          email: row.email,
          full_name: row.fullName,
          center_id: centerId,
          designation: row.designation || null,
          employee_code: row.employeeCode || null,
          status: "active",
          onboarding_completed_at: new Date().toISOString(),
        });
        await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
        if (isAdminRole(role)) {
          await sendAdminPasswordSetupEmail(row.email);
        }
        results.push({ email: row.email, ok: true });
      } catch (err) {
        results.push({
          email: row.email,
          ok: false,
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "users_bulk_imported",
      metadata: { total: data.rows.length, succeeded, failed: data.rows.length - succeeded },
    });

    return { results, succeeded, failed: data.rows.length - succeeded };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; status: "active" | "disabled" }) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "disabled"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("employees").update({ status: data.status }).eq("id", data.userId);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: `user_${data.status}`,
      target: data.userId,
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; role: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(ASSIGNABLE_ROLE_ENUM),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "role_assigned",
      target: data.userId,
      metadata: { role: data.role },
    });
    if (isAdminRole(data.role)) {
      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("email")
        .eq("id", data.userId)
        .maybeSingle();
      if (emp?.email) await sendAdminPasswordSetupEmail(emp.email);
    }
    return { ok: true };
  });

// Permanently deletes a user's auth account. Every table that references
// auth.users(id) (employees, user_roles, lesson_progress, quiz_attempts,
// certificates, assignment_submissions, notifications, etc.) has ON DELETE
// CASCADE, so this one call removes the entire user footprint in the
// database; audit_logs.actor_id is ON DELETE SET NULL instead, so this
// user's own past actions stay in the audit trail with the actor reference
// cleared rather than disappearing.
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Error("You can't delete your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("email, full_name")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((roles ?? []).some((r) => r.role === "super_admin")) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "super_admin");
      if ((count ?? 0) <= 1) {
        throw new Error("Can't delete the last super admin account.");
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user_deleted",
      target: data.userId,
      metadata: { email: employee?.email ?? null, fullName: employee?.full_name ?? null },
    });

    return { ok: true };
  });

export const publishAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; body: string }) =>
    z
      .object({
        title: z.string().trim().min(2).max(200),
        body: z.string().trim().min(2).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("announcements").insert({
      title: data.title,
      body: data.body,
      created_by: context.userId,
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "announcement_published",
      metadata: { title: data.title },
    });
    return { ok: true };
  });

// Roles that see the full, unscoped platform overview. Broader than
// assertAdmin's set (which gates mutations like creating/deleting users) —
// auditors need full read visibility for their job but shouldn't get those
// write powers, so this is intentionally a separate, read-only allowance.
const OVERVIEW_PLATFORM_ROLES = new Set([...PLATFORM_WIDE_ROLES, "auditor"]);
const OVERVIEW_ORG_SCOPED_ROLES = new Set(ORG_SCOPED_ROLES);

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: roleRows }, { data: employee }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin
        .from("employees")
        .select("organization_id,organizations(name)")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    const roleList = (roleRows ?? []).map((r) => r.role);
    const isPlatformWide = roleList.some((r) => OVERVIEW_PLATFORM_ROLES.has(r));
    const isOrgScoped = roleList.some((r) => OVERVIEW_ORG_SCOPED_ROLES.has(r));
    if (!isPlatformWide && !isOrgScoped) {
      throw new Error("Forbidden: admin role required");
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const now = new Date().toISOString();
    const orgId = employee?.organization_id ?? null;
    const orgName = (employee as { organizations?: { name: string } | null } | null)?.organizations
      ?.name;

    if (isPlatformWide) {
      const [
        employees,
        activeEmployees,
        disabledEmployees,
        newThisWeek,
        courses,
        attempts,
        certs,
        pendingSubmissions,
        gradedSubmissions,
        upcomingLive,
        logs,
      ] = await Promise.all([
        supabaseAdmin.from("employees").select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabaseAdmin
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("status", "disabled"),
        supabaseAdmin
          .from("employees")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("quiz_attempts").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("certificates").select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("assignment_submissions")
          .select("*", { count: "exact", head: true })
          .eq("status", "submitted"),
        supabaseAdmin
          .from("assignment_submissions")
          .select("*", { count: "exact", head: true })
          .eq("status", "graded"),
        supabaseAdmin
          .from("live_classes")
          .select("*", { count: "exact", head: true })
          .gte("starts_at", now),
        supabaseAdmin
          .from("audit_logs")
          .select("id,actor_email,action,created_at,target,metadata")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      return {
        scope: "platform" as const,
        orgName: null,
        employees: employees.count ?? 0,
        activeEmployees: activeEmployees.count ?? 0,
        disabledEmployees: disabledEmployees.count ?? 0,
        newThisWeek: newThisWeek.count ?? 0,
        courses: courses.count ?? 0,
        attempts: attempts.count ?? 0,
        certificates: certs.count ?? 0,
        pendingSubmissions: pendingSubmissions.count ?? 0,
        gradedSubmissions: gradedSubmissions.count ?? 0,
        upcomingLiveClasses: upcomingLive.count ?? 0,
        recentLogs: logs.data ?? [],
      };
    }

    // Org-scoped: regional_manager/center_head_doctor/org_admin/franchise_owner/
    // doctor/faculty/trainer only see their own organization's numbers.
    if (!orgId) {
      return {
        scope: "organization" as const,
        orgName: orgName ?? null,
        employees: 0,
        activeEmployees: 0,
        disabledEmployees: 0,
        newThisWeek: 0,
        courses: 0,
        attempts: 0,
        certificates: 0,
        pendingSubmissions: 0,
        gradedSubmissions: 0,
        upcomingLiveClasses: 0,
        recentLogs: [],
      };
    }

    const { data: orgEmployeeRows } = await supabaseAdmin
      .from("employees")
      .select("id,status,created_at")
      .eq("organization_id", orgId);
    const orgEmployees = orgEmployeeRows ?? [];
    const orgEmployeeIds = orgEmployees.map((e) => e.id);

    const [courses, attempts, certs, pendingSubmissions, gradedSubmissions, upcomingLive, logs] =
      await Promise.all([
        supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
        orgEmployeeIds.length
          ? supabaseAdmin
              .from("quiz_attempts")
              .select("*", { count: "exact", head: true })
              .in("user_id", orgEmployeeIds)
          : Promise.resolve({ count: 0 }),
        orgEmployeeIds.length
          ? supabaseAdmin
              .from("certificates")
              .select("*", { count: "exact", head: true })
              .in("user_id", orgEmployeeIds)
          : Promise.resolve({ count: 0 }),
        orgEmployeeIds.length
          ? supabaseAdmin
              .from("assignment_submissions")
              .select("*", { count: "exact", head: true })
              .eq("status", "submitted")
              .in("user_id", orgEmployeeIds)
          : Promise.resolve({ count: 0 }),
        orgEmployeeIds.length
          ? supabaseAdmin
              .from("assignment_submissions")
              .select("*", { count: "exact", head: true })
              .eq("status", "graded")
              .in("user_id", orgEmployeeIds)
          : Promise.resolve({ count: 0 }),
        supabaseAdmin
          .from("live_classes")
          .select("*", { count: "exact", head: true })
          .gte("starts_at", now),
        orgEmployeeIds.length
          ? supabaseAdmin
              .from("audit_logs")
              .select("id,actor_email,action,created_at,target,metadata")
              .in("actor_id", orgEmployeeIds)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] }),
      ]);

    return {
      scope: "organization" as const,
      orgName: orgName ?? null,
      employees: orgEmployees.length,
      activeEmployees: orgEmployees.filter((e) => e.status === "active").length,
      disabledEmployees: orgEmployees.filter((e) => e.status === "disabled").length,
      newThisWeek: orgEmployees.filter((e) => e.created_at >= weekAgo).length,
      courses: courses.count ?? 0,
      attempts: attempts.count ?? 0,
      certificates: certs.count ?? 0,
      pendingSubmissions: pendingSubmissions.count ?? 0,
      gradedSubmissions: gradedSubmissions.count ?? 0,
      upcomingLiveClasses: upcomingLive.count ?? 0,
      recentLogs: logs.data ?? [],
    };
  });

// Groups ISO timestamps into weekly buckets ending "now", oldest first. Done
// in JS rather than a SQL date_trunc/group-by because PostgREST doesn't
// expose aggregate grouping — this codebase's established pattern (see
// pairLoginSessions) is fetch-then-process for this kind of shaping.
function bucketByWeek(isoDates: string[], weeks: number): { weekStart: string; count: number }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const bucketStarts: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i * 7);
    bucketStarts.push(d.getTime());
  }
  const counts = new Array(weeks).fill(0) as number[];
  for (const iso of isoDates) {
    const t = new Date(iso).getTime();
    for (let i = bucketStarts.length - 1; i >= 0; i--) {
      if (t >= bucketStarts[i]) {
        counts[i]++;
        break;
      }
    }
  }
  return bucketStarts.map((t, i) => ({
    weekStart: new Date(t).toISOString().slice(0, 10),
    count: counts[i],
  }));
}

// Trend data for the admin overview's charts: weekly signups/certificates
// over the last 12 weeks, plus the most-completed courses in that window.
// Same platform-vs-organization scoping as getAdminOverview.
export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: roleRows }, { data: employee }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin
        .from("employees")
        .select("organization_id")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    const roleList = (roleRows ?? []).map((r) => r.role);
    const isPlatformWide = roleList.some((r) => OVERVIEW_PLATFORM_ROLES.has(r));
    const isOrgScoped = roleList.some((r) => OVERVIEW_ORG_SCOPED_ROLES.has(r));
    if (!isPlatformWide && !isOrgScoped) {
      throw new Error("Forbidden: admin role required");
    }

    const WEEKS = 12;
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - WEEKS * 7);
    const windowStartIso = windowStart.toISOString();

    let scopedEmployeeIds: string[] = [];
    if (!isPlatformWide) {
      const orgId = employee?.organization_id ?? null;
      if (!orgId) return { signups: [], certificates: [], topCourses: [] };
      const { data: rows } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("organization_id", orgId);
      scopedEmployeeIds = (rows ?? []).map((r) => r.id);
      if (scopedEmployeeIds.length === 0) {
        return { signups: [], certificates: [], topCourses: [] };
      }
    }

    const [signupsRes, certsRes, progressRes] = await Promise.all([
      isPlatformWide
        ? supabaseAdmin.from("employees").select("created_at").gte("created_at", windowStartIso)
        : supabaseAdmin
            .from("employees")
            .select("created_at")
            .in("id", scopedEmployeeIds)
            .gte("created_at", windowStartIso),
      isPlatformWide
        ? supabaseAdmin.from("certificates").select("issued_at").gte("issued_at", windowStartIso)
        : supabaseAdmin
            .from("certificates")
            .select("issued_at")
            .in("user_id", scopedEmployeeIds)
            .gte("issued_at", windowStartIso),
      (isPlatformWide
        ? supabaseAdmin
            .from("lesson_progress")
            .select("completed_at,lessons(course_id,courses(title))")
            .not("completed_at", "is", null)
            .gte("completed_at", windowStartIso)
        : supabaseAdmin
            .from("lesson_progress")
            .select("completed_at,lessons(course_id,courses(title))")
            .not("completed_at", "is", null)
            .gte("completed_at", windowStartIso)
            .in("user_id", scopedEmployeeIds)) as unknown as Promise<{
        data:
          | {
              completed_at: string;
              lessons: { course_id: string; courses: { title: string } | null } | null;
            }[]
          | null;
      }>,
    ]);

    const signups = bucketByWeek(
      (signupsRes.data ?? []).map((r) => r.created_at),
      WEEKS,
    );
    const certificates = bucketByWeek(
      (certsRes.data ?? []).map((r) => r.issued_at),
      WEEKS,
    );

    const courseCounts = new Map<string, { title: string; count: number }>();
    for (const row of progressRes.data ?? []) {
      const courseId = row.lessons?.course_id;
      if (!courseId) continue;
      const title = row.lessons?.courses?.title ?? "Untitled course";
      const existing = courseCounts.get(courseId);
      if (existing) existing.count += 1;
      else courseCounts.set(courseId, { title, count: 1 });
    }
    const topCourses = Array.from(courseCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { signups, certificates, topCourses };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: "active" | "disabled" | "all";
      role?: string;
      centerId?: string;
    }) =>
      z
        .object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(20),
          search: z.string().trim().max(200).optional(),
          status: z.enum(["active", "disabled", "all"]).default("all"),
          role: z.enum([...ASSIGNABLE_ROLE_ENUM, "all"]).default("all"),
          centerId: z.string().uuid().optional(),
        })
        .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // user_roles.user_id references auth.users, not employees, so there's no
    // FK PostgREST can embed on — the previous `user_roles(role)` select
    // silently failed the whole query (PGRST200) and made this page always
    // show zero employees. Fetch roles separately and merge them in JS.
    let q = supabaseAdmin
      .from("employees")
      .select(
        "id,email,full_name,status,designation,employee_code,center_id,created_at,centers(name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,employee_code.ilike.%${s}%`);
    }
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.centerId) q = q.eq("center_id", data.centerId);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const { data: rolesRows } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids)
      : { data: [] as { user_id: string; role: string }[] };
    const rolesByUser = new Map<string, { role: string }[]>();
    for (const r of rolesRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push({ role: r.role });
      rolesByUser.set(r.user_id, list);
    }
    const withRoles = (rows ?? []).map((r) => ({ ...r, user_roles: rolesByUser.get(r.id) ?? [] }));

    const filtered =
      data.role === "all"
        ? withRoles
        : withRoles.filter((r) => r.user_roles.some((ur) => ur.role === data.role));

    return {
      rows: filtered,
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / data.pageSize)),
    };
  });

export const bulkSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userIds: string[]; status: "active" | "disabled" }) =>
    z
      .object({
        userIds: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum(["active", "disabled"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employees")
      .update({ status: data.status })
      .in("id", data.userIds);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: `bulk_user_${data.status}`,
      metadata: { userIds: data.userIds, count: data.userIds.length },
    });
    return { ok: true, count: data.userIds.length };
  });

// Pairs raw login_success/logout audit events into readable sessions —
// admin-only visibility into who's signed in, for how long, and from where.
export const listLoginActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: events } = await supabaseAdmin
      .from("audit_logs")
      .select("actor_id,actor_email,action,created_at,ip,metadata")
      .in("action", ["login_success", "logout"])
      .order("created_at", { ascending: true })
      .limit(2000);

    const [{ data: employees }, { data: rolesRows }] = await Promise.all([
      supabaseAdmin.from("employees").select("id,email,full_name"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);
    const nameByEmail = new Map((employees ?? []).map((e) => [e.email, e.full_name]));
    const roleByUserId = new Map<string, string>();
    for (const r of rolesRows ?? [])
      if (!roleByUserId.has(r.user_id)) roleByUserId.set(r.user_id, r.role);

    const sessions = pairLoginSessions(
      (events ?? []).map((e) => ({
        ...e,
        metadata: e.metadata as Record<string, JsonMetadata> | null,
      })),
      { nameByEmail, roleByUserId },
    );
    return sessions.slice(0, 300);
  });

// Everything admins need to see about one employee in a single call: their
// registration/onboarding answers, login status + history, and full activity
// trail (courses viewed/completed, quizzes, edits, downloads, everything
// logAudit() records).
export const getUserActivityProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: employee }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("employees")
        .select(
          "id,email,full_name,phone,designation,employee_code,status,primary_role,learning_interests,organization_id,center_id,onboarding_completed_at,created_at,centers(name),organizations(name,org_type)",
        )
        .eq("id", data.userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
    ]);
    if (!employee) throw new Error("User not found");

    const { data: loginEvents } = await supabaseAdmin
      .from("audit_logs")
      .select("actor_id,actor_email,action,created_at,ip,metadata")
      .eq("actor_id", data.userId)
      .in("action", ["login_success", "logout"])
      .order("created_at", { ascending: true })
      .limit(1000);

    const roleByUserId = new Map<string, string>([[data.userId, employee.primary_role ?? ""]]);
    const nameByEmail = new Map([[employee.email, employee.full_name]]);
    const sessions = pairLoginSessions(
      (loginEvents ?? []).map((e) => ({
        ...e,
        metadata: e.metadata as Record<string, JsonMetadata> | null,
      })),
      { nameByEmail, roleByUserId },
    );
    const isOnline = sessions.length > 0 && sessions[0].logoutAt === null;

    const { data: activityLog } = await supabaseAdmin
      .from("audit_logs")
      .select("id,action,target,created_at,ip,metadata")
      .eq("actor_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(300);

    // certificates.user_id references auth.users, not employees — no FK for
    // PostgREST to embed courses(title) through employees, but a direct
    // certificates -> courses embed works fine since both are real FKs.
    const { data: certificates } = await supabaseAdmin
      .from("certificates")
      .select("id,cert_code,issued_at,score_percent,courses(title)")
      .eq("user_id", data.userId)
      .order("issued_at", { ascending: false });

    return {
      employee,
      roles: (roles ?? []).map((r) => r.role),
      isOnline,
      lastLogin: sessions[0] ?? null,
      sessions: sessions.slice(0, 100),
      activityLog: (activityLog ?? []).map((a) => ({
        ...a,
        metadata: a.metadata as Record<string, JsonMetadata> | null,
      })),
      certificates: certificates ?? [],
    };
  });
