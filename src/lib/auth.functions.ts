// Server functions for bootstrapping the first super admin and login flow.
// Lovable Cloud's service role key can't call the Auth Admin API, so we never
// create auth users server-side. Instead we stage intent in `pending_bootstrap`
// and finalize the promotion on first successful sign-in (finalizeBootstrap).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: only works if NO super_admin exists yet. Stages the intended admin.
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; fullName: string }) => {
    const schema = z.object({
      email: z.string().trim().toLowerCase().max(255).refine((v) => EMAIL_RE.test(v), "Invalid email"),
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
    return z.object({ email: z.string().trim().toLowerCase().max(255).refine((v) => EMAIL_RE.test(v), "Invalid email") }).parse(data) as { email: string };
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

// Record final login success + finalize any pending bootstrap for this user.
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
          });
          await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: "super_admin" });
          await supabaseAdmin.from("audit_logs").insert({
            actor_id: userId,
            actor_email: email,
            action: "bootstrap_super_admin_finalized",
          });
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
    }
    return { ok: true };
  });
