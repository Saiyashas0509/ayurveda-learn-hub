import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Award, BookOpen, GraduationCap, KeyRound, ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center px-6 py-5">
        <BrandLogo className="h-10" />
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-hero absolute inset-0" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 text-primary-foreground sm:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold">Closed Enterprise Portal</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-tight sm:text-6xl">
            The learning platform for every Travancore Ayurveda team member.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/85">
            Structured training on patient care, compliance, and therapy procedures — assigned by role, tracked
            centrally, and certified when you're ready.
          </p>

          <div className="mt-12 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
            <Link
              to="/auth"
              className="group flex flex-col rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.07] p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-primary-foreground/[0.12] hover:shadow-elevated"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-card">
                <GraduationCap className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold">Employee Sign In</h2>
              <p className="mt-1 text-sm text-primary-foreground/70">
                Sign in with your company email and a one-time code to continue your training.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold">
                Continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>

            <Link
              to="/admin/login"
              className="group flex flex-col rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.07] p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-primary-foreground/[0.12] hover:shadow-elevated"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground shadow-card">
                <KeyRound className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold">Admin Login</h2>
              <p className="mt-1 text-sm text-primary-foreground/70">
                Administrators sign in with a password for clear, traceable access.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-foreground/90">
                Continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>

          <Link
            to="/demo"
            className="mt-8 inline-block text-sm text-primary-foreground/60 underline-offset-4 hover:text-primary-foreground/90 hover:underline"
          >
            Preview the platform without signing in →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Shield,
              title: "Secure by default",
              body: "Passwordless email OTP for employees, password sign-in with audit logging for admins. No public signups.",
            },
            {
              icon: BookOpen,
              title: "Role-aware training",
              body: "Front office, therapists, doctors, auditors — every role gets the curriculum relevant to them.",
            },
            {
              icon: Award,
              title: "Verifiable certification",
              body: "Every completion generates a certificate with a unique code you can verify publicly.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-elevated"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-gold group-hover:text-gold-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Travancore Ayurveda. Internal system. Unauthorized access is prohibited.</p>
          <Link to="/verify/$code" params={{ code: "example" }} className="hover:text-foreground">
            Verify a certificate →
          </Link>
        </div>
      </footer>
    </div>
  );
}
