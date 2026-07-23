import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/admin/set-password")({
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The reset-password email link establishes a temporary session on landing.
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "expired");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Force a clean password-based login next, rather than trusting this
      // recovery-link session (which wasn't established via password).
      await supabase.auth.signOut();
      toast.success("Password set. Sign in to continue.");
      navigate({ to: "/admin/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't set password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-16" />
        </div>

        {status === "checking" && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {status === "expired" && (
          <div className="space-y-4 text-center">
            <h2 className="font-display text-2xl font-semibold">Link expired</h2>
            <p className="text-sm text-muted-foreground">
              This password link is no longer valid. Ask your administrator to resend it, or request a new one from the sign-in page.
            </p>
            <Link to="/admin/login" className="inline-block text-sm text-primary hover:underline">
              Go to admin sign in
            </Link>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-semibold">Set your password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a password for your admin account. You'll use this every time you sign in.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                autoFocus
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><ShieldCheck className="mr-2 h-4 w-4" /> Set password</>)}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
