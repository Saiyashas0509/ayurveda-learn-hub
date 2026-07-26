import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { deleteCourse, getCourseDeleteImpact } from "@/lib/course-builder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

// Requires typing the course's exact title before the delete button enables
// — this is far more destructive than deleting a lesson or module: it
// cascades away every quiz attempt and, critically, every certificate
// already earned by real learners for this course. The impact summary
// (fetched on open) exists so an admin isn't deleting that blind.
export function DeleteCourseDialog({
  courseId,
  courseTitle,
  onDeleted,
  trigger,
}: {
  courseId: string;
  courseTitle: string;
  onDeleted?: () => void;
  trigger?: ReactNode;
}) {
  const del = useServerFn(deleteCourse);
  const impactFn = useServerFn(getCourseDeleteImpact);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [impact, setImpact] = useState<{
    certificateCount: number;
    learnerCount: number;
    lessonCount: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setImpact(null);
    impactFn({ data: { courseId } })
      .then(setImpact)
      .catch(() => setImpact(null));
  }, [open, courseId, impactFn]);

  const canDelete = confirmText.trim() === courseTitle.trim();

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await del({ data: { courseId, confirmTitle: courseTitle } });
      toast.success(`"${courseTitle}" has been permanently deleted`);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete course");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmText("");
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        )}
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Delete "{courseTitle}"?</DialogTitle>
          <DialogDescription>
            This permanently deletes the course and everything in it — modules, lessons, quizzes,
            and quiz attempts. This can't be undone.
            {impact && impact.certificateCount > 0 && (
              <span className="mt-2 block font-medium text-destructive">
                {impact.certificateCount} certificate{impact.certificateCount === 1 ? "" : "s"}{" "}
                already issued for this course will be permanently deleted too.
              </span>
            )}
            {impact && impact.learnerCount > 0 && (
              <span className="mt-2 block">
                {impact.learnerCount} learner{impact.learnerCount === 1 ? "" : "s"} have progress
                recorded in this course.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>
            Type <span className="font-mono font-semibold text-foreground">{courseTitle}</span> to
            confirm
          </Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={courseTitle}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!canDelete || deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
