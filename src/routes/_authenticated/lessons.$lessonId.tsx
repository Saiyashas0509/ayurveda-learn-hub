import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getLesson, markLessonComplete, updateVideoProgress } from "@/lib/learning.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, FileText, Download, Lock, PlayCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/_authenticated/lessons/$lessonId")({
  component: LessonPage,
});

// How much slack we allow before treating a jump as a skip rather than
// normal playback jitter/buffering. Two constants, two different jobs:
//  - SEEK_SLACK: used on the `seeking` event, which fires the instant the
//    user drags the scrubber — this is what actually prevents the skip
//    (snaps back before it has any effect), so it can be tight.
//  - TIMEUPDATE_SLACK: used on `timeupdate` as a second, coarser check for
//    a position discontinuity that didn't go through a normal `seeking`
//    event at all (e.g. devtools setting currentTime directly) — needs more
//    slack since `timeupdate` fires irregularly (as infrequently as every
//    ~250ms, sometimes with real gaps from buffering), and a false positive
//    here permanently blocks completion with no self-service undo.
const SEEK_SLACK_SECONDS = 2;
const TIMEUPDATE_SLACK_SECONDS = 4;
const WATCHED_THRESHOLD = 0.98;
const PROGRESS_REPORT_INTERVAL_MS = 5000;

function LessonPage() {
  const { lessonId } = Route.useParams();
  const fn = useServerFn(getLesson);
  const mark = useServerFn(markLessonComplete);
  const reportProgress = useServerFn(updateVideoProgress);
  const navigate = useNavigate();
  const [marking, setMarking] = useState(false);
  const { data, refetch } = useSuspenseQuery(
    queryOptions({ queryKey: ["lesson", lessonId], queryFn: () => fn({ data: { lessonId } }) }),
  );

  // Hooks must run unconditionally on every render, so these live above the
  // early "locked" return below — data.watchProgress doesn't exist in the
  // locked response shape, hence the optional chaining with a permissive
  // default (irrelevant anyway, since the locked branch never renders the
  // controls these gate).
  const [videoWatchOk, setVideoWatchOk] = useState(
    data.watchProgress?.videoWatchRequirementMet ?? true,
  );
  const [skipWarning, setSkipWarning] = useState(false);

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
  const hasVideo = !!l.video_url;
  const marked = data.watchProgress.completed || marking;

  async function complete() {
    setMarking(true);
    try {
      await mark({ data: { lessonId } });
      toast.success("Lesson marked complete.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't mark this lesson complete.");
      setMarking(false);
    }
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
        <Button
          onClick={complete}
          variant={marked ? "secondary" : "default"}
          disabled={marked || (hasVideo && !videoWatchOk)}
          title={
            hasVideo && !videoWatchOk
              ? "Watch the entire video, without skipping ahead, to unlock this"
              : undefined
          }
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> {marked ? "Completed" : "Mark complete"}
        </Button>
      </div>

      {hasVideo && !videoWatchOk && !marked && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" /> Watch the full video, start to finish, to unlock
          "Mark complete" — skipping ahead isn't allowed.
        </p>
      )}
      {skipWarning && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <ShieldAlert className="h-3.5 w-3.5" /> Seeking ahead isn't allowed — please watch from
          where you left off.
        </p>
      )}

      <div className="aspect-video overflow-hidden rounded-xl border border-border bg-hero shadow-card">
        {l.video_url ? (
          <AntiSkipVideo
            key={lessonId}
            src={l.video_url}
            initialWatchedSeconds={data.watchProgress.watchedSeconds}
            initialSkipDetected={data.watchProgress.skipDetected}
            durationHint={l.duration_seconds}
            onWatchOk={setVideoWatchOk}
            onSkipAttempt={() => {
              setSkipWarning(true);
              setTimeout(() => setSkipWarning(false), 4000);
            }}
            report={(watchedSeconds, skipDetected, durationSeconds) =>
              reportProgress({
                data: { lessonId, watchedSeconds, skipDetected, durationSeconds },
              }).catch((e) => console.error("[lesson] progress report failed:", e))
            }
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
          {hasVideo && !videoWatchOk && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> Finish watching the video above to unlock the
              quiz.
            </p>
          )}
          <Button
            className="mt-4"
            disabled={hasVideo && !videoWatchOk}
            onClick={() => navigate({ to: "/quiz/$quizId", params: { quizId: data.quiz!.id } })}
          >
            Start Quiz
          </Button>
        </div>
      )}
    </div>
  );
}

function AntiSkipVideo({
  src,
  initialWatchedSeconds,
  initialSkipDetected,
  durationHint,
  onWatchOk,
  onSkipAttempt,
  report,
}: {
  src: string;
  initialWatchedSeconds: number;
  initialSkipDetected: boolean;
  durationHint: number | null;
  onWatchOk: (ok: boolean) => void;
  onSkipAttempt: () => void;
  report: (watchedSeconds: number, skipDetected: boolean, durationSeconds?: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef(initialWatchedSeconds);
  const skipDetectedRef = useRef(initialSkipDetected);
  const lastTickRef = useRef<{ time: number; wallClock: number } | null>(null);
  const durationRef = useRef(durationHint ?? 0);
  const resumedRef = useRef(false);

  const evaluate = () => {
    const duration = durationRef.current;
    const ok = skipDetectedRef.current
      ? false
      : !duration || duration <= 0
        ? true
        : maxWatchedRef.current >= duration * WATCHED_THRESHOLD;
    onWatchOk(ok);
  };

  // Only ever reports a real, measured duration (never 0/unknown) — the
  // server uses this to self-heal lessons.duration_seconds when it drifts
  // from the video file's actual length (see updateVideoProgress).
  const reportNow = () => {
    const duration = durationRef.current > 0 ? durationRef.current : undefined;
    report(maxWatchedRef.current, skipDetectedRef.current, duration);
  };

  useEffect(() => {
    evaluate();
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused) reportNow();
    }, PROGRESS_REPORT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      reportNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <video
      ref={videoRef}
      controls
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      className="h-full w-full object-cover"
      src={src}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        if (v.duration && Number.isFinite(v.duration)) durationRef.current = v.duration;
        // Resume where they left off rather than forcing a restart from 0.
        if (!resumedRef.current && maxWatchedRef.current > 5) {
          v.currentTime = Math.min(maxWatchedRef.current, v.duration || maxWatchedRef.current);
          resumedRef.current = true;
        }
        evaluate();
      }}
      onRateChange={(e) => {
        // Fast-forwarding via playback speed is still "skipping" per the
        // requirement — pin speed to normal.
        if (e.currentTarget.playbackRate !== 1) e.currentTarget.playbackRate = 1;
      }}
      onSeeking={(e) => {
        const v = e.currentTarget;
        if (v.currentTime > maxWatchedRef.current + SEEK_SLACK_SECONDS) {
          v.currentTime = maxWatchedRef.current;
          onSkipAttempt();
        }
        lastTickRef.current = { time: v.currentTime, wallClock: performance.now() };
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        const now = performance.now();
        const last = lastTickRef.current;
        lastTickRef.current = { time: v.currentTime, wallClock: now };

        if (last) {
          const wallClockElapsed = (now - last.wallClock) / 1000;
          const positionDelta = v.currentTime - last.time;
          // A position jump much bigger than the wall-clock time that
          // actually passed didn't come from normal playback — this is the
          // backstop for a jump that bypassed the `seeking` handler above
          // entirely (e.g. currentTime set directly via devtools).
          if (positionDelta > wallClockElapsed + TIMEUPDATE_SLACK_SECONDS) {
            v.currentTime = maxWatchedRef.current;
            skipDetectedRef.current = true;
            onSkipAttempt();
            reportNow();
            evaluate();
            return;
          }
        }

        if (v.currentTime > maxWatchedRef.current) maxWatchedRef.current = v.currentTime;
        evaluate();
      }}
      onEnded={(e) => {
        const duration = e.currentTarget.duration;
        if (duration && Number.isFinite(duration)) maxWatchedRef.current = duration;
        evaluate();
        reportNow();
      }}
      onPause={reportNow}
    />
  );
}
