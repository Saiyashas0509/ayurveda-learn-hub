import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDemoDashboard } from "@/lib/demo.functions";
import { BookOpen, Award, CheckCircle2, Clock, Megaphone, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/demo/")({
  component: DemoDashboard,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function DemoDashboard() {
  const fn = useServerFn(getDemoDashboard);
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["demo-dashboard"], queryFn: () => fn() }));

  return (
    <div className="space-y-8">
      <div className="bg-hero shadow-elevated relative overflow-hidden rounded-2xl p-8 text-primary-foreground">
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Preview mode</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Welcome to Travancore Ayurveda LMS</h1>
          <p className="mt-2 max-w-xl text-primary-foreground/80">
            A sample of the learner experience. Progress and certificates require sign-in.
          </p>
          <div className="mt-6">
            <Link to="/demo/catalog" className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-elevated transition-transform hover:-translate-y-0.5">
              Browse Catalog →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Completed" value={0} tone="success" />
        <StatCard icon={Clock} label="In progress" value={0} tone="primary" />
        <StatCard icon={Award} label="Certificates" value={0} tone="gold" />
        <StatCard icon={BookOpen} label="Available courses" value={data.courses.length} tone="muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Featured courses</h2>
            <Link to="/demo/catalog" className="text-sm text-primary hover:underline">
              View catalog <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.courses.map((c) => {
              const catName = (c as { course_categories?: { name?: string } }).course_categories?.name;
              return (
                <Link
                  key={c.id}
                  to="/demo/courses/$slug"
                  params={{ slug: c.slug }}
                  className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
                >
                  <p className="text-xs font-medium uppercase tracking-widest text-gold">{catName ?? "Course"}</p>
                  <h3 className="mt-2 font-display text-lg font-semibold group-hover:text-primary">{c.title}</h3>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" /> Ayurvedic training module
                  </div>
                </Link>
              );
            })}
            {data.courses.length === 0 && (
              <p className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No courses published yet.
              </p>
            )}
          </div>
        </div>

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

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: "success" | "primary" | "gold" | "muted"; }) {
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