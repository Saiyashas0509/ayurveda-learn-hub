import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listMyAssignments } from "@/lib/assignments.functions";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assignments/")({
  component: MyAssignments,
});

function MyAssignments() {
  const list = useServerFn(listMyAssignments);
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["my-assignments"], queryFn: () => list() }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Coursework</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold">
          <FileText className="h-6 w-6" /> My Assignments
        </h1>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
        {data.map((a) => {
          const sub = a.submission;
          const status = sub ? sub.status : "not-submitted";
          return (
            <li key={a.id}>
              <Link
                to="/assignments/$assignmentId"
                params={{ assignmentId: a.id }}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(a.courses as { title?: string } | null)?.title ?? ""}
                    {a.due_at && ` · Due ${new Date(a.due_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={status === "graded" ? "default" : status === "submitted" ? "secondary" : "outline"}>
                    {status === "graded" ? `Graded ${sub?.grade}/${a.max_score}` : status === "submitted" ? "Submitted" : "Not submitted"}
                  </Badge>
                  {sub?.is_late && <p className="mt-1 text-[10px] text-destructive">Late</p>}
                </div>
              </Link>
            </li>
          );
        })}
        {data.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No assignments yet.</li>}
      </ul>
    </div>
  );
}