import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { startQuizAttempt, submitQuizAttempt } from "@/lib/learning.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Clock, CheckCircle2, XCircle, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quiz/$quizId")({
  component: QuizPage,
});

type Question = {
  id: string;
  type: string;
  prompt: string;
  image_url: string | null;
  options: { id: string; text: string }[];
};

function QuizPage() {
  const { quizId } = Route.useParams();
  const navigate = useNavigate();
  const start = useServerFn(startQuizAttempt);
  const submit = useServerFn(submitQuizAttempt);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<{ score: number; passed: boolean; certCode: string | null } | null>(null);

  useEffect(() => {
    start({ data: { quizId } })
      .then((r) => {
        setAttemptId(r.attemptId);
        setQuestions(r.questions as Question[]);
        setRemaining(r.quiz.time_limit_seconds ?? 600);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to start"))
      .finally(() => setLoading(false));
  }, [start, quizId]);

  useEffect(() => {
    if (loading || result || remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, loading, result]);

  useEffect(() => {
    if (remaining === 0 && !result && attemptId && !loading) doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  async function doSubmit() {
    setSubmitting(true);
    try {
      const payload = questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] ?? null }));
      const r = await submit({ data: { attemptId, answers: payload } });
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${result.passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {result.passed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        </div>
        <h1 className="font-display text-3xl font-semibold">
          {result.passed ? "Congratulations!" : "Not quite there yet"}
        </h1>
        <p className="text-muted-foreground">
          You scored <span className="text-3xl font-semibold text-foreground">{result.score}%</span>
        </p>
        {result.certCode && (
          <div className="rounded-xl border border-gold/40 bg-gold/10 p-6">
            <Award className="mx-auto h-8 w-8 text-gold-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Certificate issued</p>
            <p className="mt-1 font-mono text-lg font-semibold">{result.certCode}</p>
          </div>
        )}
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate({ to: "/catalog" })}>Back to catalog</Button>
          <Button onClick={() => navigate({ to: "/certificates" })}>My certificates</Button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const mins = Math.floor(remaining / 60);
  const secs = String(remaining % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Question <span className="font-medium text-foreground">{current + 1}</span> of {questions.length}
        </p>
        <div className={`flex items-center gap-2 rounded-md px-3 py-1 text-sm ${remaining < 60 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
          <Clock className="h-3.5 w-3.5" />
          {mins}:{secs}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-medium">{q.prompt}</h2>
        {q.image_url && <img src={q.image_url} alt="" className="mt-4 max-h-64 rounded-md" />}
        <div className="mt-6 space-y-2">
          {q.options.map((o) => {
            const selected = answers[q.id] === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary" : "border-border"}`}>
                  {selected && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                </span>
                <span className="text-sm">{o.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
        ) : (
          <Button onClick={doSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Quiz"}
          </Button>
        )}
      </div>
    </div>
  );
}
