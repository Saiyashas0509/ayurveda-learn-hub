import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useState } from "react";
import { getCourse, getCourseRatings, submitCourseRating } from "@/lib/learning.functions";
import {
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  PlayCircle,
  MessagesSquare,
  Video,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses/$slug")({
  component: CoursePage,
});

function CoursePage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getCourse);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["course", slug], queryFn: () => fn({ data: { slug } }) }),
  );
  const completed = data.lessons.filter((l) => data.progress[l.id]).length;
  const pct = data.lessons.length ? Math.round((completed / data.lessons.length) * 100) : 0;
  const hasStarted = data.lessons.some((l) => l.id in data.progress);

  return (
    <div className="space-y-8">
      <div
        className="relative overflow-hidden rounded-2xl bg-hero p-8 text-primary-foreground shadow-elevated"
        style={
          data.course.cover_url
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${data.course.cover_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Course</p>
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
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            to="/discussions/$courseId"
            params={{ courseId: data.course.id }}
            className="inline-flex items-center gap-2 rounded-md bg-primary-foreground/10 px-3 py-1.5 hover:bg-primary-foreground/20"
          >
            <MessagesSquare className="h-4 w-4" /> Discussions
          </Link>
          <Link
            to="/live"
            search={{ courseId: data.course.id }}
            className="inline-flex items-center gap-2 rounded-md bg-primary-foreground/10 px-3 py-1.5 hover:bg-primary-foreground/20"
          >
            <Video className="h-4 w-4" /> Live Classes
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-5">
          <h2 className="font-display text-xl font-semibold">Lessons</h2>
        </div>
        <ul className="divide-y divide-border">
          {data.lessons.map((l, i) => {
            const done = data.progress[l.id];
            // Mirrors the server-side check in getLesson: a lesson needs the
            // one before it in this (already course-ordered) list completed.
            const locked = i > 0 && !data.progress[data.lessons[i - 1].id];
            const content = (
              <>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${locked ? "text-muted-foreground" : ""}`}
                  >
                    {l.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {locked
                      ? "Complete the previous lesson to unlock"
                      : `${Math.round((l.duration_seconds ?? 0) / 60)} min`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {locked ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : done ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  {!locked && <PlayCircle className="h-5 w-5 text-primary" />}
                </div>
              </>
            );
            return (
              <li key={l.id}>
                {locked ? (
                  <div className="flex cursor-not-allowed items-center gap-4 px-5 py-4 opacity-60">
                    {content}
                  </div>
                ) : (
                  <Link
                    to="/lessons/$lessonId"
                    params={{ lessonId: l.id }}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
          {data.lessons.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">No lessons yet.</li>
          )}
        </ul>
      </div>

      <RatingBlock courseId={data.course.id} canRate={hasStarted} />
    </div>
  );
}

function RatingBlock({ courseId, canRate }: { courseId: string; canRate: boolean }) {
  const fetchRatings = useServerFn(getCourseRatings);
  const rate = useServerFn(submitCourseRating);
  const qc = useQueryClient();
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const { data } = useQuery({
    queryKey: ["course-ratings", courseId],
    queryFn: () => fetchRatings({ data: { courseId } }),
  });

  const mut = useMutation({
    mutationFn: (rating: number) =>
      rate({ data: { courseId, rating, comment: comment || undefined } }),
    onSuccess: () => {
      toast.success("Thanks for the feedback");
      qc.invalidateQueries({ queryKey: ["course-ratings", courseId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't submit rating"),
  });

  if (!data) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Ratings</h2>
        {data.count > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-gold text-gold" />
            <span className="font-medium text-foreground">{data.average}</span>
            <span>
              ({data.count} rating{data.count === 1 ? "" : "s"})
            </span>
          </div>
        )}
      </div>

      {canRate ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => mut.mutate(n)}
                disabled={mut.isPending}
              >
                <Star
                  className={`h-6 w-6 ${
                    n <= (hover || data.myRating || 0)
                      ? "fill-gold text-gold"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
            {data.myRating && (
              <span className="ml-2 text-xs text-muted-foreground">
                Your rating: {data.myRating}
              </span>
            )}
          </div>
          <Textarea
            placeholder="Optional feedback…"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {comment && (
            <Button
              size="sm"
              disabled={mut.isPending}
              onClick={() => mut.mutate(data.myRating || hover || 5)}
            >
              Save feedback
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Start the course to leave a rating.</p>
      )}
    </div>
  );
}
