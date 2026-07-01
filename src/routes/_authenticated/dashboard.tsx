import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getMyDashboard } from "@/lib/learning.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth-helpers";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Award, CheckCircle2, Clock, Megaphone, ArrowRight } from "lucide-react";

function dashboardQuery(fn: () => Promise<Awaited<ReturnType<typeof getMyDashboard>>>) {
  return queryOptions({
    queryKey: ["dashboard"],
    queryFn: () => fn(),
  });
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getMyDashboard);
  const { data } = useSuspenseQuery(dashboardQuery(() => fn()));

  const total = data.completedCount + data.pendingCount;
  const pct = total > 0 ? Math.round((data.completedCount / total) * 100) : 0;
  const firstName = data.employee?.full_name?.split(" ")[0] ?? "there";
  const roleLabel = data.roles[0] ? ROLE_LABELS[data.roles[0] as AppRole] : "Employee";
  const centerName = (data.employee as { centers?: { name?: string } } | null | undefined)?.centers?.name ?? "—";

  return (
    <div className="space-y-8">
      {/* Hero welcome */}
      <div className="bg-hero shadow-elevated relative overflow-hidden rounded-2xl p-8 text-primary-foreground">
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Welcome back</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Hello, {firstName}</h1>
          <p className="mt-2 max-w-xl text-primary-foreground/80">
            {roleLabel} · {centerName}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="min-w-[240px] flex-1">
              <div className="mb-2 flex items-center justify-between text-xs text-primary-foreground/80">
                <span>Overall training progress</span>
                <span className="font-medium">{pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/15">
                <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link
              to="/catalog"
              className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-elevated transition-transform hover:-translate-y-0.5"
            >
              Continue Learning →
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Completed lessons" value={data.completedCount} tone="success" />
        <StatCard icon={Clock} label="In progress" value={data.pendingCount} tone="primary" />
        <StatCard icon={Award} label="Certificates" value={data.certificates.length} tone="gold" />
        <StatCard icon={BookOpen} label="Available courses" value={data.courses.length} tone="muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent courses */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Recommended for you</h2>
            <Link to="/catalog" className="text-sm text-primary hover:underline">
              View catalog <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.courses.map((c) => {
              const catName = (c as { course_categories?: { name?: string } }).course_categories?.name;
              return (
              <Link
                key={c.id}
                to="/courses/$slug"
                params={{ slug: c.slug }}
                className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <p className="text-xs font-medium uppercase tracking-widest text-gold">
                  {catName ?? "Course"}
                </p>
                <h3 className="mt-2 font-display text-lg font-semibold group-hover:text-primary">{c.title}</h3>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" /> Ayurvedic training module
                </div>
              </Link>
            );})}
            {data.courses.length === 0 && (
              <p className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No courses published yet.
              </p>
            )}
          </div>
        </div>

        {/* Announcements */}
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold">Announcements</h2>
          <div className="space-y-3">
            {data.announcements.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{a.body}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(a.published_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {data.announcements.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No announcements.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "success" | "primary" | "gold" | "muted";
}) {
  const toneMap = {
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold-foreground",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${toneMap[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 text-3xl font-semibold font-display">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

// keep Progress imported for tree-shaking sanity
export const _u = Progress;
