// Server functions for bootstrapping the first super admin and login flow.
// Lovable Cloud's service role key can't call the Auth Admin API, so we never
// create auth users server-side. Instead we stage intent in `pending_bootstrap`
// and finalize the promotion on first successful sign-in (finalizeBootstrap).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ADMIN_ONLY_ROLES } from "@/lib/auth-helpers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: only works if NO super_admin exists yet. Stages the intended admin.
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; fullName: string }) => {
    const schema = z.object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .max(255)
        .refine((v) => EMAIL_RE.test(v), "Invalid email"),
      fullName: z.string().trim().min(2).max(120),
    });
    return schema.parse(data) as { email: string; fullName: string };
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

    // Stage the intended super admin — promotion happens on first sign-in.
    const { error: upErr } = await supabaseAdmin
      .from("pending_bootstrap")
      .upsert({ email: data.email, full_name: data.fullName });
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_email: data.email,
      action: "bootstrap_super_admin_staged",
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

// Check whether an email is allowed to sign in (employee OR pending bootstrap).
export const requestLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    return z
      .object({
        email: z
          .string()
          .trim()
          .toLowerCase()
          .max(255)
          .refine((v) => EMAIL_RE.test(v), "Invalid email"),
      })
      .parse(data) as { email: string };
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

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id, status")
      .eq("email", data.email)
      .maybeSingle();

    let allowed = false;
    let isNewSignup = false;

    if (emp) {
      if (emp.status !== "active") {
        throw new Error("Your account is disabled. Contact your administrator.");
      }
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", emp.id);
      const isAdminAccount = (roles ?? []).some((r) =>
        (ADMIN_ONLY_ROLES as string[]).includes(r.role),
      );
      if (isAdminAccount) {
        await supabaseAdmin.from("audit_logs").insert({
          actor_email: data.email,
          action: "otp_request_denied_admin_requires_password",
        });
        throw new Error(
          "This account requires password sign-in. Use the admin login page instead.",
        );
      }
      allowed = true;
    } else {
      const { data: pending } = await supabaseAdmin
        .from("pending_bootstrap")
        .select("email")
        .eq("email", data.email)
        .maybeSingle();
      if (pending) {
        allowed = true;
        isNewSignup = true;
      } else {
        // Allow self-signup — onboarding wizard will restrict role to self-signup roles.
        allowed = true;
        isNewSignup = true;
      }
    }

    await supabaseAdmin.from("login_attempts").insert({ email: data.email, success: false });
    await supabaseAdmin.from("audit_logs").insert({
      actor_email: data.email,
      action: allowed ? "otp_requested" : "otp_request_denied_no_employee",
    });

    // Do not reveal existence to clients — always return the same shape.
    return { ok: true, allowed, isNewSignup };
  });

// Called right after a successful OTP verification (post-Google or post-
// email) to stamp this auth user as verified for the current login cycle.
// Stored on app_metadata (not user_metadata — the client can't write
// app_metadata) so /auth's own mount check and the route guard can both read
// it straight off the session, with no extra query.
export const confirmOtpVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      app_metadata: { ...existing?.user?.app_metadata, otp_verified_at: new Date().toISOString() },
    });
    return { ok: true };
  });

// Called on sign-out so the next sign-in requires the OTP step again, even
// if a Google session gets re-established without the user re-authenticating.
export const clearOtpVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      app_metadata: { ...existing?.user?.app_metadata, otp_verified_at: null },
    });
    return { ok: true };
  });

// Records a logout event for the admin-visible login/logout activity view.
// Must run before the actual supabase.auth.signOut() — once the session is
// gone this authenticated call can no longer identify who's logging out.
export const recordLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = ((context.claims as { email?: string }).email ?? "").toLowerCase();
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      actor_email: email,
      action: "logout",
    });
    return { ok: true };
  });

// Record final login success + finalize any pending bootstrap for this user.
// Also enforces that admin-role accounts (super_admin/hr_admin) only complete
// sign-in via password — OTP/Google sessions for those accounts get rejected
// here and the client signs them back out, pointing them to /admin/login.
export const recordLoginSuccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = ((context.claims as { email?: string }).email ?? "").toLowerCase();
    const userId = context.userId;

    if (email) {
      // Finalize bootstrap: if this email was staged and no super_admin exists yet, promote.
      const { data: pending } = await supabaseAdmin
        .from("pending_bootstrap")
        .select("email, full_name")
        .eq("email", email)
        .maybeSingle();

      if (pending) {
        const { count: adminCount } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "super_admin");

        if ((adminCount ?? 0) === 0) {
          await supabaseAdmin.from("employees").upsert({
            id: userId,
            email,
            full_name: pending.full_name,
            status: "active",
            designation: "Super Administrator",
            // Skip the self-signup onboarding wizard — /setup already collected this.
            onboarding_completed_at: new Date().toISOString(),
          });
          await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "super_admin" });
          await supabaseAdmin.from("audit_logs").insert({
            actor_id: userId,
            actor_email: email,
            action: "bootstrap_super_admin_finalized",
          });
          // This first login was necessarily OTP-based (no password exists yet).
          // Immediately send a password-setup email; the check below will then
          // sign them out and send them to set one before they can proceed.
          const { supabase } = await import("@/integrations/supabase/client");
          const { getSiteOrigin } = await import("@/lib/site-origin");
          await supabase.auth
            .resetPasswordForEmail(email, { redirectTo: `${getSiteOrigin()}/admin/set-password` })
            .catch((err) => console.error("[bootstrap-password-setup] failed:", err));
        }
        await supabaseAdmin.from("pending_bootstrap").delete().eq("email", email);
      } else {
        // Existing employee: ensure their employees.id matches auth uid (link on first login).
        const { data: emp } = await supabaseAdmin
          .from("employees")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (emp && emp.id !== userId) {
          await supabaseAdmin.from("employees").update({ id: userId }).eq("email", email);
        }
      }

      await supabaseAdmin.from("login_attempts").insert({ email, success: true });
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        actor_email: email,
        action: "login_success",
      });

      // Enforce password-only auth for admin roles, regardless of how this
      // session was established (OTP, Google, or the bootstrap promotion above).
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdminAccount = (roles ?? []).some((r) =>
        (ADMIN_ONLY_ROLES as string[]).includes(r.role),
      );
      if (isAdminAccount) {
        const amr = (context.claims as { amr?: { method?: string }[] }).amr ?? [];
        const usedPassword = amr.some((entry) => entry.method === "password");
        if (!usedPassword) {
          await supabaseAdmin.from("audit_logs").insert({
            actor_id: userId,
            actor_email: email,
            action: "admin_login_rejected_no_password",
          });
          throw new Error("ADMIN_PASSWORD_REQUIRED");
        }
      }
    }
    return { ok: true };
  });
