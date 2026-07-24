// Admin-only server functions: create employees, assign roles, disable users,
// publish announcements, read audit logs. All re-check role server-side.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ADMIN_ONLY_ROLES, type AppRole } from "@/lib/auth-helpers";
import { getSiteOrigin } from "@/lib/site-origin";
import { pairLoginSessions, type JsonMetadata } from "@/lib/login-sessions";

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
          role: z.enum([
            "super_admin",
            "hr_admin",
            "regional_manager",
            "center_head_doctor",
            "front_office",
            "therapist",
            "trainer",
            "auditor",
          ]),
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
        role: z.enum([
          "super_admin",
          "hr_admin",
          "regional_manager",
          "center_head_doctor",
          "front_office",
          "therapist",
          "trainer",
          "auditor",
        ]),
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

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const now = new Date().toISOString();
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
  });

const EMPLOYEE_ROLE_ENUM = [
  "super_admin",
  "hr_admin",
  "regional_manager",
  "center_head_doctor",
  "front_office",
  "therapist",
  "trainer",
  "auditor",
] as const;

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
          role: z.enum([...EMPLOYEE_ROLE_ENUM, "all"]).default("all"),
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
    };
  });
