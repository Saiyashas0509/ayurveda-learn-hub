import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getLesson, markLessonComplete } from "@/lib/learning.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, FileText, Download, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/lessons/$lessonId")({
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const fn = useServerFn(getLesson);
  const mark = useServerFn(markLessonComplete);
  const navigate = useNavigate();
  const [marked, setMarked] = useState(false);
  const { data, refetch } = useSuspenseQuery(
    queryOptions({ queryKey: ["lesson", lessonId], queryFn: () => fn({ data: { lessonId } }) }),
  );

  if (data.locked) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-card">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-semibold">This lesson is locked</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Complete the previous lesson in "{data.courseTitle ?? "this course"}" to unlock "
          {data.lessonTitle}".
        </p>
        {data.courseSlug && (
          <Link
            to="/courses/$slug"
            params={{ slug: data.courseSlug }}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to course
          </Link>
        )}
      </div>
    );
  }

  const l = data.lesson!;
  const course = (l as { courses?: { title?: string; slug?: string } }).courses;

  async function complete() {
    await mark({ data: { lessonId } });
    setMarked(true);
    toast.success("Lesson marked complete.");
    await refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link
            to="/courses/$slug"
            params={{ slug: course?.slug ?? "" }}
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            ← {course?.title ?? "Course"}
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{l.title}</h1>
        </div>
        <Button onClick={complete} variant={marked ? "secondary" : "default"} disabled={marked}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> {marked ? "Completed" : "Mark complete"}
        </Button>
      </div>

      <div className="aspect-video overflow-hidden rounded-xl border border-border bg-hero shadow-card">
        {l.video_url ? (
          <video
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            className="h-full w-full object-cover"
            src={l.video_url}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-primary-foreground/80">
            <div className="text-center">
              <PlayCircle className="mx-auto h-12 w-12 text-gold" />
              <p className="mt-2 text-sm">Video not yet uploaded</p>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList>
          <TabsTrigger value="notes">Key Notes</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        <TabsContent
          value="notes"
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
            {l.key_notes || "No notes available for this lesson."}
          </pre>
        </TabsContent>
        <TabsContent
          value="transcript"
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {l.transcript || "No transcript available."}
          </p>
        </TabsContent>
        <TabsContent
          value="resources"
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <div className="space-y-2">
            {l.pdf_url && (
              <a
                href={l.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> Reading material (PDF){" "}
                <Download className="ml-auto h-4 w-4" />
              </a>
            )}
            {!l.pdf_url && (
              <p className="text-sm text-muted-foreground">No downloadable resources.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {data.quiz && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-6 shadow-card">
          <p className="text-xs uppercase tracking-widest text-gold-foreground/80">
            Assessment ready
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold">{data.quiz.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Passing score {data.quiz.pass_percent}% · Time limit{" "}
            {Math.round((data.quiz.time_limit_seconds ?? 0) / 60)} min
          </p>
          <Button
            className="mt-4"
            onClick={() => navigate({ to: "/quiz/$quizId", params: { quizId: data.quiz!.id } })}
          >
            Start Quiz
          </Button>
        </div>
      )}
    </div>
  );
}
