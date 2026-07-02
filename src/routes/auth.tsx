import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestLoginOtp, recordLoginSuccess } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap, ShieldCheck, Mail, ArrowRight, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const request = useServerFn(requestLoginOtp);
  const record = useServerFn(recordLoginSuccess);
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

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
      await record({}).catch(() => null);
      toast.success("Welcome back.");
      navigate({ to: "/dashboard" });
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-gold-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold leading-tight">Travancore Ayurveda</p>
              <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Learning Portal</p>
            </div>
          </div>
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
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold leading-tight">Travancore Ayurveda</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Learning Portal</p>
              </div>
            </div>
          </div>

          {stage === "email" ? (
            <form onSubmit={handleRequest} className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-semibold">Employee Sign In</h2>
                <p className="mt-1 text-sm text-muted-foreground">Enter your company email to receive a one-time code.</p>
              </div>
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
        </div>
      </div>
    </div>
  );
}
