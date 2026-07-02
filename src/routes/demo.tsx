import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo — Travancore Ayurveda Learning" },
      { name: "description", content: "Preview the Travancore Ayurveda learning platform without signing in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-gold/40 bg-gold/15 text-center text-xs text-gold-foreground">
        <div className="mx-auto max-w-6xl px-6 py-2">
          You're viewing a read-only demo. <Link to="/auth" className="font-semibold underline">Sign in</Link> to track progress and earn certificates.
        </div>
      </div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/demo"><BrandLogo className="h-10" /></Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/demo" className="text-muted-foreground hover:text-foreground" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground font-medium" }}>Dashboard</Link>
          <Link to="/demo/catalog" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Catalog</Link>
          <Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign In</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}