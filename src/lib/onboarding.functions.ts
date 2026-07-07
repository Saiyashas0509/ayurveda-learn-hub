// Onboarding: capture role + organization + learning interests after first sign-in.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LEARNING_INTERESTS, SELF_SIGNUP_ROLES, type AppRole } from "@/lib/auth-helpers";

const ALL_ROLES: AppRole[] = [
  "student", "doctor", "therapist", "franchise_owner", "corporate_employee",
  "hospital_staff", "faculty", "org_admin",
  "front_office", "trainer", "center_head_doctor", "regional_manager",
  "hr_admin", "auditor", "super_admin",
];

// Load the current user's onboarding status + selectable orgs/centers +
// any pre-seeded pending_bootstrap record.
export const getOnboardingContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId, claims } = context;
    const email = ((claims as { email?: string }).email ?? "").toLowerCase();

    const [{ data: emp }, { data: pending }, { data: orgs }, { data: centers }] = await Promise.all([
      supabaseAdmin.from("employees").select("id,email,full_name,onboarding_completed_at,organization_id,center_id,primary_role,learning_interests,phone,designation").eq("id", userId).maybeSingle(),
      email ? supabaseAdmin.from("pending_bootstrap").select("*").eq("email", email).maybeSingle() : Promise.resolve({ data: null }),
      supabaseAdmin.from("organizations").select("id,name,slug,org_type").eq("is_active", true).order("name"),
      supabaseAdmin.from("centers").select("id,name,organization_id,city,center_type").order("name"),
    ]);

    const isBootstrapAdmin = !!pending && !emp?.onboarding_completed_at;

    return {
      email,
      employee: emp,
      pending,
      organizations: orgs ?? [],
      centers: centers ?? [],
      allowedRoles: isBootstrapAdmin ? (["super_admin"] as AppRole[]) : (pending?.requested_role ? [pending.requested_role as AppRole] : SELF_SIGNUP_ROLES),
      completed: !!emp?.onboarding_completed_at,
    };
  });

const InterestSchema = z.enum(LEARNING_INTERESTS);

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    fullName: string;
    phone?: string;
    designation?: string;
    role: AppRole;
    organizationId: string;
    centerId?: string | null;
    learningInterests: string[];
  }) => {
    return z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(40).optional().or(z.literal("")),
      designation: z.string().trim().max(120).optional().or(z.literal("")),
      role: z.enum(ALL_ROLES as [AppRole, ...AppRole[]]),
      organizationId: z.string().uuid(),
      centerId: z.string().uuid().nullable().optional(),
      learningInterests: z.array(InterestSchema).min(1).max(LEARNING_INTERESTS.length),
    }).parse(data);
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId, claims } = context;
    const email = ((claims as { email?: string }).email ?? "").toLowerCase();

    // Determine allowed role: must match pending_bootstrap OR be a self-signup role.
    const { data: pending } = await supabaseAdmin
      .from("pending_bootstrap")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    let requestedRole: AppRole = data.role;
    if (pending?.requested_role) {
      requestedRole = pending.requested_role as AppRole;
    } else if (pending && !pending.requested_role) {
      // Legacy super-admin bootstrap: only allow if no super_admin exists yet.
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "super_admin");
      requestedRole = (count ?? 0) === 0 ? "super_admin" : "student";
    } else if (!SELF_SIGNUP_ROLES.includes(requestedRole)) {
      throw new Error("This role requires an admin invitation. Please contact your administrator.");
    }

    // Resolve org: pending overrides; otherwise use submitted.
    const organizationId = pending?.organization_id ?? data.organizationId;
    const centerId = pending?.center_id ?? data.centerId ?? null;

    // Upsert employee row.
    const { error: empErr } = await supabaseAdmin.from("employees").upsert({
      id: userId,
      email,
      full_name: pending?.full_name ?? data.fullName,
      phone: data.phone || pending?.phone || null,
      designation: data.designation || pending?.designation || null,
      status: "active",
      organization_id: organizationId,
      center_id: centerId,
      primary_role: requestedRole,
      learning_interests: data.learningInterests,
      onboarding_completed_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (empErr) throw new Error(empErr.message);

    // Grant role (idempotent thanks to unique(user_id, role)).
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: requestedRole },
      { onConflict: "user_id,role" },
    );

    // Consume pending bootstrap if any.
    if (pending) {
      await supabaseAdmin.from("pending_bootstrap").delete().eq("email", email);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      actor_email: email,
      action: "onboarding_completed",
      metadata: { role: requestedRole, organization_id: organizationId, interests: data.learningInterests },
    });

    return { ok: true, role: requestedRole, organizationId };
  });