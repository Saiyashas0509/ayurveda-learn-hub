import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listSubmissionsForGrading, gradeSubmission } from "@/lib/assignments.functions";
import { getSignedDownloadUrl } from "@/lib/course-builder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatusPill } from "@/components/admin/status-pill";
import { StatTile } from "@/components/admin/stat-tile";
import {
  TABLE_WRAP,
  TABLE,
  THEAD,
  TH,
  TH_RIGHT,
  TBODY,
  TR,
  TD,
  TD_RIGHT,
  EMPTY_ROW,
} from "@/components/admin/table";
import { toast } from "sonner";
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Percent,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/submissions")({
  component: SubmissionsPage,
});

const PAGE_SIZE = 20;

function SubmissionsPage() {
  const list = useServerFn(listSubmissionsForGrading);
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "submitted" | "graded">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [grading, setGrading] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = ["submissions", { assignmentFilter, status, debouncedSearch, page }];
  const { data, isLoading, isFetching } = useQuery(
    queryOptions({
      queryKey,
      queryFn: () =>
        list({
          data: {
            assignmentId: assignmentFilter === "all" ? undefined : assignmentFilter,
            status,
            search: debouncedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
          },
        }),
      placeholderData: (prev) => prev,
    }),
  );

  const submissions = data?.submissions ?? [];
  const assignments = data?.assignments ?? [];
  const pageCount = data?.pageCount ?? 1;
  const stats = data?.stats;

  const grading_row = grading ? (submissions.find((s) => s.id === grading) ?? null) : null;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Grading"
        description="Review and grade student assignment submissions."
        actions={
          <div className="w-64">
            <Select
              value={assignmentFilter}
              onValueChange={(v) => {
                setAssignmentFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignments</SelectItem>
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title} — {(a.courses as { title?: string } | null)?.title ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={ClipboardList}
            label="Pending"
            value={stats.pending}
            tone={stats.pending > 0 ? "warning" : "default"}
          />
          <StatTile icon={CheckCircle2} label="Graded" value={stats.graded} tone="success" />
          <StatTile icon={Percent} label="Average grade" value={stats.avgGrade ?? "—"} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search student name or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">Pending</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
          </SelectContent>
        </Select>
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        )}
      </div>

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Student</th>
              <th className={TH}>Assignment</th>
              <th className={TH}>Submitted</th>
              <th className={TH}>Status</th>
              <th className={TH}>Grade</th>
              <th className={TH_RIGHT}>Actions</th>
            </tr>
          </thead>
          <tbody className={TBODY}>
            {submissions.map((s) => {
              const student = s.employees as { full_name?: string; email?: string } | null;
              const assignment = s.assignments as { title?: string; max_score?: number } | null;
              return (
                <tr key={s.id} className={TR}>
                  <td className={TD}>
                    <p className="font-medium">{student?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{student?.email ?? ""}</p>
                  </td>
                  <td className={TD}>{assignment?.title ?? "—"}</td>
                  <td className={TD}>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {new Date(s.submitted_at).toLocaleString()}
                      {s.is_late && (
                        <StatusPill tone="danger" dot={false}>
                          Late
                        </StatusPill>
                      )}
                    </div>
                  </td>
                  <td className={TD}>
                    <StatusPill tone={s.status === "graded" ? "success" : "warning"}>
                      {s.status}
                    </StatusPill>
                  </td>
                  <td className={TD}>
                    {s.grade != null ? `${s.grade}/${assignment?.max_score ?? 100}` : "—"}
                  </td>
                  <td className={TD_RIGHT}>
                    <Button size="sm" variant="outline" onClick={() => setGrading(s.id)}>
                      {s.status === "graded" ? "Review" : "Grade"}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && submissions.length === 0 && (
              <tr>
                <td colSpan={6} className={EMPTY_ROW}>
                  No submissions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {grading_row && <GradeDialog submission={grading_row} onClose={() => setGrading(null)} />}
    </div>
  );
}

function GradeDialog({
  submission,
  onClose,
}: {
  submission: {
    id: string;
    file_url: string | null;
    file_name: string | null;
    grade: number | null;
    feedback: string | null;
    assignments: unknown;
  };
  onClose: () => void;
}) {
  const assignment = submission.assignments as {
    title?: string;
    max_score?: number;
    rubric?: string;
  } | null;
  const grade = useServerFn(gradeSubmission);
  const dl = useServerFn(getSignedDownloadUrl);
  const qc = useQueryClient();
  const [g, setG] = useState(submission.grade ?? 0);
  const [fb, setFb] = useState(submission.feedback ?? "");

  const mut = useMutation({
    mutationFn: () => grade({ data: { submissionId: submission.id, grade: g, feedback: fb } }),
    onSuccess: () => {
      toast.success("Grade saved");
      qc.invalidateQueries({ queryKey: ["submissions"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const openFile = async () => {
    if (!submission.file_url) return;
    const { url } = await dl({
      data: { bucket: "assignment-submissions", path: submission.file_url },
    });
    window.open(url, "_blank");
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grade — {assignment?.title}</DialogTitle>
        </DialogHeader>
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
            <label className="text-sm font-medium">
              Grade (out of {assignment?.max_score ?? 100})
            </label>
            <Input
              type="number"
              value={g}
              onChange={(e) => setG(Number(e.target.value))}
              min={0}
              max={assignment?.max_score ?? 100}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Feedback</label>
            <Textarea rows={4} value={fb} onChange={(e) => setFb(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            Save grade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
