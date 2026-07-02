import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDemoLesson } from "@/lib/demo.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Download, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/demo/lessons/$lessonId")({
  component: DemoLessonPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function DemoLessonPage() {
  const { lessonId } = Route.useParams();
  const fn = useServerFn(getDemoLesson);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["demo-lesson", lessonId], queryFn: () => fn({ data: { lessonId } }) }),
  );

  if (!data.lesson) {
    return <p className="text-sm text-muted-foreground">Lesson not found.</p>;
  }
  const l = data.lesson;
  const course = (l as { courses?: { title?: string; slug?: string } }).courses;

  return (
    <div className="space-y-6">
      <div>
        {course?.slug && (
          <Link to="/demo/courses/$slug" params={{ slug: course.slug }} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            ← {course.title ?? "Course"}
          </Link>
        )}
        <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{l.title}</h1>
      </div>

      <div className="aspect-video overflow-hidden rounded-xl border border-border bg-hero shadow-card">
        {l.video_url ? (
          <video controls className="h-full w-full object-cover" src={l.video_url} />
        ) : (
          <div className="flex h-full items-center justify-center text-primary-foreground/80">
            <div className="text-center">
              <PlayCircle className="mx-auto h-12 w-12 text-gold" />
              <p className="mt-2 text-sm">Sample lesson — video not uploaded</p>
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
        <TabsContent value="notes" className="rounded-xl border border-border bg-card p-6 shadow-card">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
            {l.key_notes || "No notes available for this lesson."}
          </pre>
        </TabsContent>
        <TabsContent value="transcript" className="rounded-xl border border-border bg-card p-6 shadow-card">
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {l.transcript || "No transcript available."}
          </p>
        </TabsContent>
        <TabsContent value="resources" className="rounded-xl border border-border bg-card p-6 shadow-card">
          {l.pdf_url ? (
            <a href={l.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent">
              <FileText className="h-4 w-4" /> Reading material (PDF) <Download className="ml-auto h-4 w-4" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No downloadable resources.</p>
          )}
        </TabsContent>
      </Tabs>

      {data.quiz && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-6 shadow-card">
          <p className="text-xs uppercase tracking-widest text-gold-foreground/80">Assessment</p>
          <h3 className="mt-1 font-display text-xl font-semibold">{data.quiz.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Passing score {data.quiz.pass_percent}% · Time limit {Math.round((data.quiz.time_limit_seconds ?? 0) / 60)} min
          </p>
          <Link
            to="/demo/quiz/$quizId"
            params={{ quizId: data.quiz.id }}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Preview Quiz
          </Link>
        </div>
      )}
    </div>
  );
}