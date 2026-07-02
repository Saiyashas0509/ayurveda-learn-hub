import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Award, BookOpen } from "lucide-react";
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
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <BrandLogo className="h-16" imgClassName="scale-[20]" />
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Employee Sign In
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-hero absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-primary-foreground">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold">Closed Enterprise Portal</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-tight sm:text-6xl">
            The learning platform for every Travancore Ayurveda team member.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/85">
            Structured training on patient care, NABH compliance, therapy procedures and more — assigned by role,
            tracked centrally, and certified when you're ready.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-elevated transition-transform hover:-translate-y-0.5"
            >
              Sign in with company email
            </Link>
            <Link
              to="/setup"
              className="rounded-md border border-primary-foreground/30 px-5 py-2.5 text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10"
            >
              First-time setup
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Shield, title: "Secure by default", body: "Passwordless email OTP, session timeouts, and role-based access. No public signups." },
            { icon: BookOpen, title: "Role-aware training", body: "Front office, therapists, doctors, auditors — every role gets the right curriculum." },
            { icon: Award, title: "Verifiable certification", body: "Every completion generates a certificate with a unique code you can verify publicly." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
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
