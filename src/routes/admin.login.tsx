import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordLoginSuccess } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const record = useServerFn(recordLoginSuccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error("Sign in failed.");
      await record({});
      toast.success("Welcome back.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid email or password.";
      // Surface the server's own reasoning (e.g. disabled account) rather than
      // masking everything as "invalid credentials".
      toast.error(
        msg.includes("ADMIN_PASSWORD_REQUIRED") ? "Something went wrong. Try again." : msg,
      );
      await supabase.auth.signOut().catch(() => null);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const addr = email.trim().toLowerCase();
    if (!addr) {
      toast.error("Enter your email first.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo: `${window.location.origin}/admin/set-password`,
      });
      if (error) throw error;
      toast.success("If that account exists, a reset link has been sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="bg-hero absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <BrandLogo onDark className="h-40" />
          <div>
            <h1 className="max-w-md font-display text-4xl font-semibold leading-tight">
              Administrator access.
            </h1>
            <p className="mt-4 max-w-md text-primary-foreground/80">
              Admin accounts sign in with a password for clear, traceable access to sensitive
              actions.
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm text-primary-foreground/70">
              <KeyRound className="h-4 w-4 text-gold" />
              Every admin action is audit-logged to your account.
            </div>
          </div>
          <p className="text-xs text-primary-foreground/60">
            © {new Date().getFullYear()} Travancore Ayurveda · Internal use only
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo className="h-16" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-semibold">Admin Sign In</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in with your admin email and password.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="admin@travancoreayurveda.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-password">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-xs text-primary hover:underline disabled:text-muted-foreground"
                >
                  {resetLoading ? "Sending…" : "Forgot password?"}
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Not an admin?{" "}
              <Link to="/auth" className="text-primary hover:underline">
                Sign in here
              </Link>
            </p>

            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="hover:text-foreground hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="hover:text-foreground hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
