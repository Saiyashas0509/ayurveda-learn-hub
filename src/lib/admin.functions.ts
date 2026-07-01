// Admin-only server functions: create employees, assign roles, disable users,
// publish announcements, read audit logs. All re-check role server-side.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

export const createEmployeeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    email: string;
    fullName: string;
    role: string;
    centerId?: string | null;
    designation?: string;
    employeeCode?: string;
  }) => {
    return z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      fullName: z.string().trim().min(2).max(120),
      role: z.enum([
        "super_admin","hr_admin","regional_manager","center_head_doctor",
        "front_office","therapist","trainer","auditor",
      ]),
      centerId: z.string().uuid().nullable().optional(),
      designation: z.string().max(120).optional(),
      employeeCode: z.string().max(40).optional(),
    }).parse(data);
  })
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
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user_created",
      target: userId,
      metadata: { email: data.email, role: data.role },
    });
    return { ok: true, userId };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; status: "active" | "disabled" }) =>
    z.object({
      userId: z.string().uuid(),
      status: z.enum(["active", "disabled"]),
    }).parse(data),
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
    z.object({
      userId: z.string().uuid(),
      role: z.enum([
        "super_admin","hr_admin","regional_manager","center_head_doctor",
        "front_office","therapist","trainer","auditor",
      ]),
    }).parse(data),
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
    return { ok: true };
  });

export const publishAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; body: string }) =>
    z.object({
      title: z.string().trim().min(2).max(200),
      body: z.string().trim().min(2).max(4000),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("announcements").insert({
      title: data.title, body: data.body, created_by: context.userId,
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "announcement_published", metadata: { title: data.title },
    });
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [employees, courses, attempts, certs, logs] = await Promise.all([
      supabaseAdmin.from("employees").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("quiz_attempts").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("certificates").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("audit_logs").select("id,actor_email,action,created_at,target,metadata").order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      employees: employees.count ?? 0,
      courses: courses.count ?? 0,
      attempts: attempts.count ?? 0,
      certificates: certs.count ?? 0,
      recentLogs: logs.data ?? [],
    };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("employees")
      .select("id,email,full_name,status,designation,employee_code,center_id,centers(name),user_roles(role)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
