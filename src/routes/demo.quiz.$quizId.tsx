import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDemoQuiz } from "@/lib/demo.functions";
import { Info } from "lucide-react";

export const Route = createFileRoute("/demo/quiz/$quizId")({
  component: DemoQuizPage,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function DemoQuizPage() {
  const { quizId } = Route.useParams();
  const fn = useServerFn(getDemoQuiz);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["demo-quiz", quizId], queryFn: () => fn({ data: { quizId } }) }),
  );

  if (!data.quiz) return <p className="text-sm text-muted-foreground">Quiz not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Assessment preview</p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{data.quiz.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Passing score {data.quiz.pass_percent}% · {data.questions.length} questions
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-foreground" />
        <div>
          You're previewing this quiz in demo mode. Answers aren't scored and no certificate is issued.{" "}
          <Link to="/auth" className="font-semibold underline">Sign in</Link> to take it for real.
        </div>
      </div>

      <ol className="space-y-6">
        {data.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Question {i + 1}</p>
            <p className="mt-2 font-medium">{q.prompt}</p>
            <ul className="mt-4 space-y-2">
              {q.options.map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                  <span className="h-4 w-4 rounded-full border border-border" />
                  {o.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {data.questions.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No questions in this quiz yet.
          </li>
        )}
      </ol>
    </div>
  );
}