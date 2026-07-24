import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { deleteUser } from "@/lib/admin.functions";
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

// Requires typing the user's exact email before the delete button enables —
// a plain confirm dialog is too easy to click through for something this
// destructive (permanently removes the account and cascades through every
// table that references it: progress, quiz attempts, certificates, etc.).
export function DeleteUserDialog({
  userId,
  userEmail,
  userName,
  onDeleted,
  trigger,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  onDeleted?: () => void;
  trigger?: ReactNode;
}) {
  const del = useServerFn(deleteUser);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText.trim().toLowerCase() === userEmail.trim().toLowerCase();

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await del({ data: { userId } });
      toast.success(`${userName} has been permanently deleted`);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {userName}?</DialogTitle>
          <DialogDescription>
            This permanently deletes their account and login access, along with all associated data
            — course progress, quiz attempts, certificates, submissions, and activity history. This
            can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>
            Type <span className="font-mono font-semibold text-foreground">{userEmail}</span> to
            confirm
          </Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={userEmail}
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
