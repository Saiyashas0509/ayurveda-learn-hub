import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestLoginOtp, recordLoginSuccess } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Mail, ArrowRight, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.1 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.3 5.3C40.4 36.4 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const request = useServerFn(requestLoginOtp);
  const record = useServerFn(recordLoginSuccess);
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Returns true if the session is good to proceed to /dashboard, false if
  // it was an admin account that needs to go through /admin/login instead
  // (in which case this already signed them out and redirected).
  async function finalizeSession(): Promise<boolean> {
    try {
      await record({});
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("ADMIN_PASSWORD_REQUIRED")) {
        await supabase.auth.signOut();
        toast.error("This account requires password sign-in.");
        navigate({ to: "/admin/login" });
        return false;
      }
      // Non-fatal for other errors — don't block a real session over a logging hiccup.
      return true;
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        if (await finalizeSession()) navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      // Browser is redirected to Google; nothing else to do here.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      toast.error(msg);
      setGoogleLoading(false);
    }
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const addr = email.trim().toLowerCase();
      // Server checks employee/pending-bootstrap allow-list, rate limit, audit
      const res = await request({ data: { email: addr } });
      if (res.allowed) {
        const { error } = await supabase.auth.signInWithOtp({
          email: addr,
          options: { shouldCreateUser: res.isNewSignup },
        });
        if (error) throw error;
      }
      // Always show the OTP stage to avoid leaking whether the email is registered.
      toast.success("If your account exists, an OTP has been sent.");
      setStage("otp");
      setCooldown(30);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (error) throw error;
      if (!data.session) throw new Error("Verification failed.");
      if (await finalizeSession()) {
        toast.success("Welcome back.");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid code.";
      toast.error(msg);
    } finally {
      setLoading(false);
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
              Continue your learning journey — securely.
            </h1>
            <p className="mt-4 max-w-md text-primary-foreground/80">
              Sign in with your company email. We'll send a one-time verification code — no passwords to remember.
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm text-primary-foreground/70">
              <ShieldCheck className="h-4 w-4 text-gold" />
              Rate-limited, session-timed, and fully audit-logged.
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

          {stage === "email" ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-semibold">Employee Sign In</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sign in with Google or your company email.</p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                disabled={googleLoading}
                onClick={handleGoogleSignIn}
              >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <><GoogleIcon className="mr-2 h-4 w-4" /> Continue with Google</>
                )}
              </Button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleRequest} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Company email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@travancoreayurveda.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Send verification code <ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Access is restricted to registered employees. Contact your administrator if you need an account.
              </p>
              </form>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-semibold">Enter your code</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in 5 minutes.
                </p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading || code.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStage("email"); setCode(""); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← Use a different email
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={() => handleRequest({ preventDefault: () => {} } as React.FormEvent)}
                  className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Admin? <Link to="/admin/login" className="text-primary hover:underline">Sign in with your password</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
