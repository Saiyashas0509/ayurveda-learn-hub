// Integration-managed protected layout: ssr: false, redirects to /auth when signed out.
// Do not add child beforeLoad auth gates — this parent handles it, and the
// registered functionMiddleware attaches the bearer token to protected server fns.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Every login must pass OTP — except admin accounts, which authenticate
    // with a password at /admin/login and never go through the OTP flow.
    // getUser() always re-fetches from the server, so this reflects the
    // latest verification state (e.g. right after a sign-out clears it).
    if (!data.user.app_metadata?.otp_verified_at) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "super_admin" || r.role === "hr_admin");
      if (!isAdmin) throw redirect({ to: "/auth" });
    }

    // Gate: force onboarding until an employees row with onboarding_completed_at exists.
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: emp } = await supabase
        .from("employees")
        .select("onboarding_completed_at")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!emp?.onboarding_completed_at) {
        throw redirect({ to: "/onboarding" });
      }
    }

    // Gate: everyone must explicitly accept Terms & Privacy before proceeding.
    // Self-signup users do this as part of the onboarding wizard above; accounts
    // created directly by an admin (which skip onboarding entirely) hit this
    // separate checkpoint on first login instead. Excluded here for /onboarding
    // too, so mid-onboarding self-signup users aren't bounced to a second page.
    if (
      !location.pathname.startsWith("/onboarding") &&
      !location.pathname.startsWith("/accept-terms") &&
      !data.user.app_metadata?.terms_accepted_at
    ) {
      throw redirect({ to: "/accept-terms" });
    }

    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
