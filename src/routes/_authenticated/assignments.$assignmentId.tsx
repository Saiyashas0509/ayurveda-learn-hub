import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { getAssignment, submitAssignment } from "@/lib/assignments.functions";
import { getSignedDownloadUrl } from "@/lib/course-builder.functions";
import { uploadToBucket } from "@/lib/upload-helper";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileText, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assignments/$assignmentId")({
  component: AssignmentDetail,
});

function AssignmentDetail() {
  const { assignmentId } = Route.useParams();
  const fetch = useServerFn(getAssignment);
  const submit = useServerFn(submitAssignment);
  const dl = useServerFn(getSignedDownloadUrl);
  const qc = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);

  const { data } = useSuspenseQuery(queryOptions({
    queryKey: ["assignment", assignmentId],
    queryFn: () => fetch({ data: { id: assignmentId } }),
  }));

  const a = data.assignment;
  const sub = data.submission;
  const isOverdue = a.due_at ? new Date() > new Date(a.due_at) : false;
  const locked = isOverdue && !a.allow_late && !sub;

  const upload = async (file: File) => {
    setProgress(0);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { path, kind } = await uploadToBucket({
        bucket: "assignment-submissions", file,
        pathPrefix: `${user.user.id}/${assignmentId}`,
        onProgress: setProgress,
      });
      await submit({ data: { assignmentId, fileUrl: path, fileName: file.name, fileKind: kind } });
      toast.success("Submission uploaded");
      qc.invalidateQueries({ queryKey: ["assignment", assignmentId] });
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setProgress(null); }
  };

  const openSubmission = async () => {
    if (!sub?.file_url) return;
    const { url } = await dl({ data: { bucket: "assignment-submissions", path: sub.file_url } });
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <Link to="/assignments" className="text-xs text-muted-foreground hover:underline">← All assignments</Link>

      <div className="rounded-2xl bg-hero p-8 text-primary-foreground shadow-elevated">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          {(a.courses as { title?: string } | null)?.title ?? "Assignment"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{a.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {a.due_at && <span className="rounded-full bg-primary-foreground/10 px-3 py-1">Due {new Date(a.due_at).toLocaleString()}</span>}
          <span className="rounded-full bg-primary-foreground/10 px-3 py-1">Max {a.max_score}</span>
          {a.allow_late && <span className="rounded-full bg-gold text-gold-foreground px-3 py-1 text-xs font-medium">Late allowed</span>}
        </div>
      </div>

      {a.instructions && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-2 font-display text-lg font-semibold">Instructions</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.instructions}</p>
        </section>
      )}

      {a.rubric && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-2 font-display text-lg font-semibold">Rubric</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.rubric}</p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-3 font-display text-lg font-semibold">Your submission</h2>

        {sub ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> {sub.file_name}</span>
              <div className="flex items-center gap-2">
                {sub.is_late && <Badge variant="destructive">Late</Badge>}
                <Badge variant={sub.status === "graded" ? "default" : "secondary"}>{sub.status}</Badge>
                <Button size="sm" variant="ghost" onClick={openSubmission}>
                  <Download className="mr-1 h-3 w-3" /> View
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Submitted {new Date(sub.submitted_at).toLocaleString()}</p>

            {sub.status === "graded" && (
              <div className="rounded-md border border-success/40 bg-success/10 p-3">
                <p className="text-sm font-semibold">Grade: {sub.grade} / {a.max_score}</p>
                {sub.feedback && <p className="mt-2 whitespace-pre-wrap text-sm">{sub.feedback}</p>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">You haven't submitted yet.</p>
        )}

        {!locked && (
          <div className="mt-4">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg,.gif,.webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <Upload className="h-5 w-5" />
              <span>{sub ? "Replace submission" : "Upload file (PDF, DOCX, ZIP, image)"}</span>
            </label>
            {progress !== null && <Progress value={progress} className="mt-3" />}
          </div>
        )}
        {locked && (
          <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This assignment is past due and late submissions are not allowed.
          </p>
        )}
      </section>
    </div>
  );
}