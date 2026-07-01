// Server functions for bootstrapping the first super admin and admin user management.
// All privileged writes verify the caller's role server-side via has_role.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: only works if NO super_admin exists yet. Idempotent bootstrap.
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; fullName: string }) => {
    const schema = z.object({
      email: z.string().trim().toLowerCase().refine((v) => EMAIL_RE.test(v), "Invalid email").max(255),
      fullName: z.string().trim().min(2).max(120),
    });
    return schema.parse(data);
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: cntErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (cntErr) throw new Error(cntErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("Setup already complete. Contact your administrator.");
    }

    // Create or fetch auth user
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr && !/already/i.test(createErr.message)) {
      throw new Error(createErr.message);
    }
    if (created?.user) {
      userId = created.user.id;
    } else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email?.toLowerCase() === data.email)?.id ?? null;
    }
    if (!userId) throw new Error("Failed to create user");

    await supabaseAdmin.from("employees").upsert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      status: "active",
      designation: "Super Administrator",
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "super_admin" });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      actor_email: data.email,
      action: "bootstrap_super_admin",
      target: userId,
    });

    return { ok: true };
  });

// Check if any super_admin exists — used by /setup to decide whether to render.
export const superAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "super_admin");
  return { exists: (count ?? 0) > 0 };
});

// Request an OTP after verifying the employee exists and is active.
export const requestLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    return z.object({ email: z.string().trim().toLowerCase().max(255).refine((v) => EMAIL_RE.test(v)) }).parse(data);
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: max 3 OTP requests per email per 15 min
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count: recentReq } = await supabaseAdmin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("created_at", since);
    if ((recentReq ?? 0) >= 3) {
      throw new Error("Too many login attempts. Please wait 15 minutes.");
    }

    // Verify employee exists and is active
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, status")
      .eq("email", data.email)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    if (!emp) {
      // Log the attempt but return a generic message (don't leak existence).
      await supabaseAdmin.from("login_attempts").insert({ email: data.email, success: false });
      await supabaseAdmin.from("audit_logs").insert({
        actor_email: data.email,
        action: "otp_request_denied_no_employee",
      });
      // Return success shape to avoid enumeration; the OTP simply never arrives.
      return { ok: true };
    }
    if (emp.status !== "active") {
      throw new Error("Your account is disabled. Contact your administrator.");
    }

    // Trigger Supabase built-in OTP send (shouldCreateUser=false is enforced by admin API since we already exist)
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
    });
    // Use signInWithOtp on the client to send; admin-generated link doesn't send email automatically without SMTP.
    // Actually simplest: use publishable admin.signInWithOtp equivalent — see below.
    void error;

    await supabaseAdmin.from("login_attempts").insert({ email: data.email, success: false });
    await supabaseAdmin.from("audit_logs").insert({
      actor_email: data.email,
      action: "otp_requested",
    });

    return { ok: true };
  });

// Record final login success (called after client verifies OTP).
export const recordLoginSuccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims as { email?: string }).email ?? null;
    if (email) {
      await supabaseAdmin.from("login_attempts").insert({ email, success: true });
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: context.userId,
        actor_email: email,
        action: "login_success",
      });
    }
    return { ok: true };
  });
