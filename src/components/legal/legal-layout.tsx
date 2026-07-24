import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft } from "lucide-react";

export function LegalLayout({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <BrandLogo className="h-10" />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Effective {effectiveDate}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{title}</h1>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:leading-relaxed [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground">
          {children}
        </div>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground hover:underline">
            Terms &amp; Conditions
          </Link>
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            Privacy Policy
          </Link>
          <Link to="/cookies" className="hover:text-foreground hover:underline">
            Cookie Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
