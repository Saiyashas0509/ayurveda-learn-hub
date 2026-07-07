import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listAuthoredCourses, upsertCourse } from "@/lib/course-builder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/courses/")({
  component: CourseBuilderList,
});

function CourseBuilderList() {
  const list = useServerFn(listAuthoredCourses);
  const create = useServerFn(upsertCourse);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["authored-courses"], queryFn: () => list() }));

  const mut = useMutation({
    mutationFn: () => create({ data: { title, description: desc } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["authored-courses"] });
      setOpen(false); setTitle(""); setDesc("");
      toast.success("Course created");
      nav({ to: "/admin/courses/$courseId", params: { courseId: res.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Authoring</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold">
            <Wrench className="h-6 w-6" /> Course Builder
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Create modules, lessons, quizzes and assignments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Course</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Course title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Short description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button onClick={() => mut.mutate()} disabled={title.trim().length < 2 || mut.isPending}>
                {mut.isPending ? "Creating…" : "Create draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card">
        <ul className="divide-y divide-border">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to="/admin/courses/$courseId"
                params={{ courseId: c.id }}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    v{c.version} · {c.last_published_at ? `published ${new Date(c.last_published_at).toLocaleDateString()}` : "never published"}
                  </p>
                </div>
                <Badge variant={c.is_published ? "default" : "secondary"}>
                  {c.is_published ? "Published" : "Draft"}
                </Badge>
              </Link>
            </li>
          ))}
          {data.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">No courses yet — create your first one.</li>
          )}
        </ul>
      </div>
    </div>
  );
}