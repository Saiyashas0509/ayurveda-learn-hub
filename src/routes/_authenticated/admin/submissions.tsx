import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listSubmissionsForGrading, gradeSubmission } from "@/lib/assignments.functions";
import { getSignedDownloadUrl } from "@/lib/course-builder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardCheck, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/submissions")({
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const list = useServerFn(listSubmissionsForGrading);
  const [filter, setFilter] = useState<string>("all");
  const [grading, setGrading] = useState<string | null>(null);
  const { data } = useSuspenseQuery(queryOptions({
    queryKey: ["submissions", filter],
    queryFn: () => list({ data: { assignmentId: filter === "all" ? undefined : filter } }),
  }));

  const grading_row = grading ? data.submissions.find((s) => s.id === grading) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Faculty</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold">
            <ClipboardCheck className="h-6 w-6" /> Grading
          </h1>
        </div>
        <div className="w-72">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignments</SelectItem>
              {data.assignments.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.title} — {(a.courses as { title?: string } | null)?.title ?? ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Assignment</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Grade</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.submissions.map((s) => {
              const student = (s.employees as { full_name?: string; email?: string } | null);
              const assignment = (s.assignments as { title?: string; max_score?: number } | null);
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{student?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{student?.email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">{assignment?.title ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(s.submitted_at).toLocaleString()}
                    {s.is_late && <Badge variant="destructive" className="ml-2">Late</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === "graded" ? "default" : "secondary"}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{s.grade != null ? `${s.grade}/${assignment?.max_score ?? 100}` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setGrading(s.id)}>
                      {s.status === "graded" ? "Review" : "Grade"}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {data.submissions.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No submissions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {grading_row && (
        <GradeDialog submission={grading_row} onClose={() => setGrading(null)} />
      )}
    </div>
  );
}

function GradeDialog({ submission, onClose }: {
  submission: {
    id: string; file_url: string | null; file_name: string | null; grade: number | null;
    feedback: string | null; assignments: unknown;
  };
  onClose: () => void;
}) {
  const assignment = submission.assignments as { title?: string; max_score?: number; rubric?: string } | null;
  const grade = useServerFn(gradeSubmission);
  const dl = useServerFn(getSignedDownloadUrl);
  const qc = useQueryClient();
  const [g, setG] = useState(submission.grade ?? 0);
  const [fb, setFb] = useState(submission.feedback ?? "");

  const mut = useMutation({
    mutationFn: () => grade({ data: { submissionId: submission.id, grade: g, feedback: fb } }),
    onSuccess: () => { toast.success("Grade saved"); qc.invalidateQueries({ queryKey: ["submissions"] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const openFile = async () => {
    if (!submission.file_url) return;
    const { url } = await dl({ data: { bucket: "assignment-submissions", path: submission.file_url } });
    window.open(url, "_blank");
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Grade — {assignment?.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {submission.file_url && (
            <Button variant="outline" onClick={openFile} className="w-full justify-start">
              <Download className="mr-2 h-4 w-4" /> {submission.file_name ?? "Open submission"}
            </Button>
          )}
          {assignment?.rubric && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Rubric</p>
              <p className="whitespace-pre-wrap text-sm">{assignment.rubric}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Grade (out of {assignment?.max_score ?? 100})</label>
            <Input type="number" value={g} onChange={(e) => setG(Number(e.target.value))} min={0} max={assignment?.max_score ?? 100} />
          </div>
          <div>
            <label className="text-sm font-medium">Feedback</label>
            <Textarea rows={4} value={fb} onChange={(e) => setFb(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save grade</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}