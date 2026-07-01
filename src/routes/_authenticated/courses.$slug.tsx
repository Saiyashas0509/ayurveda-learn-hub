import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getCourse } from "@/lib/learning.functions";
import { CheckCircle2, Circle, Clock, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/courses/$slug")({
  component: CoursePage,
});

function CoursePage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getCourse);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["course", slug], queryFn: () => fn({ data: { slug } }) }),
  );
  const catName = (data.course as { course_categories?: { name?: string } }).course_categories?.name;

  const completed = data.lessons.filter((l) => data.progress[l.id]).length;
  const pct = data.lessons.length ? Math.round((completed / data.lessons.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-hero p-8 text-primary-foreground shadow-elevated">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">{catName ?? "Course"}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{data.course.title}</h1>
        <p className="mt-3 max-w-2xl text-primary-foreground/80">{data.course.description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          <span className="rounded-full bg-primary-foreground/10 px-3 py-1">
            {data.lessons.length} lessons
          </span>
          <span className="rounded-full bg-primary-foreground/10 px-3 py-1">
            <Clock className="mr-1 inline h-3 w-3" /> {data.course.duration_minutes ?? 0} min
          </span>
          <span className="rounded-full bg-gold text-gold-foreground px-3 py-1 font-medium">
            {pct}% complete
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-5">
          <h2 className="font-display text-xl font-semibold">Lessons</h2>
        </div>
        <ul className="divide-y divide-border">
          {data.lessons.map((l, i) => {
            const done = data.progress[l.id];
            return (
              <li key={l.id}>
                <Link
                  to="/lessons/$lessonId"
                  params={{ lessonId: l.id }}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {Math.round((l.duration_seconds ?? 0) / 60)} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <PlayCircle className="h-5 w-5 text-primary" />
                  </div>
                </Link>
              </li>
            );
          })}
          {data.lessons.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">No lessons yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
