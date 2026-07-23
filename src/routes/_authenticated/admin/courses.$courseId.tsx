import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getCourseForEdit,
  upsertCourse,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  publishCourse,
  unpublishCourse,
  createQuizInline,
  attachQuizToLesson,
  upsertAssignment,
  deleteAssignment,
} from "@/lib/course-builder.functions";
import { uploadToBucket } from "@/lib/upload-helper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { GripVertical, Plus, Trash2, Video, FileText, Wand2, Upload, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/courses/$courseId")({
  component: CourseBuilder,
});

type Resource = { id: string; name: string; url: string; kind: string; size?: number };

function CourseBuilder() {
  const { courseId } = Route.useParams();
  const fetchCourse = useServerFn(getCourseForEdit);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["course-edit", courseId],
      queryFn: () => fetchCourse({ data: { courseId } }),
    }),
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["course-edit", courseId] });

  return (
    <div className="space-y-6">
      <Link to="/admin/courses" className="text-xs text-muted-foreground hover:underline">
        ← Back to courses
      </Link>

      <CourseHeader course={data.course} onSaved={invalidate} />

      <Tabs defaultValue="structure" className="w-full">
        <TabsList>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="assignments">Assignments ({data.assignments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="mt-4">
          <Structure
            courseId={courseId}
            modules={data.modules}
            lessons={data.lessons}
            quizzes={data.quizzes}
            onChanged={invalidate}
          />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <Assignments
            courseId={courseId}
            lessons={data.lessons}
            assignments={data.assignments}
            onChanged={invalidate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CourseHeader({
  course,
  onSaved,
}: {
  course: {
    id: string;
    title: string;
    description: string | null;
    cover_url: string | null;
    preview_allowed: boolean;
    is_published: boolean;
    version: number;
    last_published_at: string | null;
    duration_minutes: number | null;
  };
  onSaved: () => void;
}) {
  const save = useServerFn(upsertCourse);
  const pub = useServerFn(publishCourse);
  const unpub = useServerFn(unpublishCourse);
  const [title, setTitle] = useState(course.title);
  const [desc, setDesc] = useState(course.description ?? "");
  const [preview, setPreview] = useState(course.preview_allowed);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: course.id,
          title,
          description: desc,
          preview_allowed: preview,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const pubMut = useMutation({
    mutationFn: () =>
      course.is_published
        ? unpub({ data: { courseId: course.id } })
        : pub({ data: { courseId: course.id } }),
    onSuccess: () => {
      toast.success(course.is_published ? "Unpublished" : "Published");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold"
          />
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="Description"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="preview" checked={preview} onCheckedChange={setPreview} />
              <Label htmlFor="preview" className="text-sm">
                Preview allowed
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
        </div>

        <div className="w-56 space-y-3 text-right">
          <Badge variant={course.is_published ? "default" : "secondary"} className="text-xs">
            {course.is_published ? "Published" : "Draft"}
          </Badge>
          <p className="text-xs text-muted-foreground">Version {course.version}</p>
          <p className="text-xs text-muted-foreground">
            {course.last_published_at
              ? `Last published ${new Date(course.last_published_at).toLocaleString()}`
              : "Never published"}
          </p>
          <Button className="w-full" onClick={() => pubMut.mutate()} disabled={pubMut.isPending}>
            {course.is_published ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ================= Structure (modules + lessons) =================

function Structure({
  courseId,
  modules,
  lessons,
  quizzes,
  onChanged,
}: {
  courseId: string;
  modules: { id: string; title: string; sort_order: number }[];
  lessons: {
    id: string;
    title: string;
    module_id: string | null;
    sort_order: number;
    video_url: string | null;
    duration_seconds: number | null;
    preview_allowed: boolean;
    description: string | null;
    resources: unknown;
  }[];
  quizzes: { id: string; title: string; lesson_id: string | null; pass_percent: number }[];
  onChanged: () => void;
}) {
  const addModule = useServerFn(createModule);
  const reorder = useServerFn(reorderModules);
  const [newTitle, setNewTitle] = useState("");
  const [editingLesson, setEditingLesson] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [order, setOrder] = useState(modules.map((m) => m.id));
  const modKey = modules.map((m) => m.id).join("|");
  useEffect(() => {
    setOrder(modules.map((m) => m.id));
  }, [modKey]);

  const addMut = useMutation({
    mutationFn: () => addModule({ data: { courseId, title: newTitle } }),
    onSuccess: () => {
      setNewTitle("");
      toast.success("Module added");
      onChanged();
    },
  });

  const handleDrag = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = order.indexOf(String(e.active.id));
    const newIdx = order.indexOf(String(e.over.id));
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    reorder({ data: { orderedIds: next } }).then(onChanged);
  };

  const sortedModules = order.map((id) => modules.find((m) => m.id === id)!).filter(Boolean);

  const unassignedLessons = lessons.filter((l) => !l.module_id);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="New module title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <Button
          onClick={() => addMut.mutate()}
          disabled={newTitle.trim().length < 1 || addMut.isPending}
        >
          <Plus className="mr-1 h-4 w-4" /> Module
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDrag}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {sortedModules.map((m) => (
            <ModuleCard
              key={m.id}
              courseId={courseId}
              module={m}
              lessons={lessons
                .filter((l) => l.module_id === m.id)
                .sort((a, b) => a.sort_order - b.sort_order)}
              quizzes={quizzes}
              onChanged={onChanged}
              onEditLesson={setEditingLesson}
            />
          ))}
        </SortableContext>
      </DndContext>

      {unassignedLessons.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Unassigned lessons
          </p>
          {unassignedLessons.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-sm"
            >
              <span>{l.title}</span>
              <Button size="sm" variant="ghost" onClick={() => setEditingLesson(l.id)}>
                Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      {editingLesson && (
        <LessonEditor
          courseId={courseId}
          lesson={lessons.find((l) => l.id === editingLesson)!}
          quizzes={quizzes}
          onClose={() => setEditingLesson(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function ModuleCard({
  courseId,
  module: mod,
  lessons,
  quizzes,
  onChanged,
  onEditLesson,
}: {
  courseId: string;
  module: { id: string; title: string };
  lessons: {
    id: string;
    title: string;
    sort_order: number;
    preview_allowed: boolean;
    video_url: string | null;
  }[];
  quizzes: { id: string; title: string; lesson_id: string | null }[];
  onChanged: () => void;
  onEditLesson: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mod.id });
  const updM = useServerFn(updateModule);
  const delM = useServerFn(deleteModule);
  const addL = useServerFn(createLesson);
  const reorderL = useServerFn(reorderLessons);
  const [title, setTitle] = useState(mod.title);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  const style = { transform: CSS.Transform.toString(transform), transition };

  const [order, setOrder] = useState(lessons.map((l) => l.id));
  const lessonKey = lessons.map((l) => l.id).join("|");
  useEffect(() => {
    setOrder(lessons.map((l) => l.id));
  }, [lessonKey]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleDrag = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(
      order,
      order.indexOf(String(e.active.id)),
      order.indexOf(String(e.over.id)),
    );
    setOrder(next);
    reorderL({ data: { moduleId: mod.id, orderedIds: next } }).then(onChanged);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card shadow-card"
    >
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button {...attributes} {...listeners} className="cursor-grab p-1 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() =>
            title !== mod.title && updM({ data: { id: mod.id, title } }).then(onChanged)
          }
          className="flex-1 border-0 bg-transparent px-2 text-base font-semibold shadow-none focus-visible:ring-1"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Delete module and unlink its lessons?"))
              delM({ data: { id: mod.id } }).then(onChanged);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDrag}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {order.map((id) => {
                const l = lessons.find((x) => x.id === id);
                if (!l) return null;
                const q = quizzes.find((q) => q.lesson_id === l.id);
                return (
                  <LessonRow
                    key={l.id}
                    lesson={l}
                    hasQuiz={!!q}
                    hasVideo={!!l.video_url}
                    onEdit={() => onEditLesson(l.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-3 flex gap-2">
          <Input
            placeholder="New lesson title"
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              if (newLessonTitle.trim())
                addL({ data: { courseId, moduleId: mod.id, title: newLessonTitle } }).then(() => {
                  setNewLessonTitle("");
                  onChanged();
                });
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Lesson
          </Button>
        </div>
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  hasQuiz,
  hasVideo,
  onEdit,
}: {
  lesson: { id: string; title: string; preview_allowed: boolean };
  hasQuiz: boolean;
  hasVideo: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: lesson.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-2"
    >
      <button {...attributes} {...listeners} className="cursor-grab p-1 text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 truncate text-sm">{lesson.title}</span>
      {hasVideo && <Video className="h-3.5 w-3.5 text-primary" aria-label="Has video" />}
      {hasQuiz && <Wand2 className="h-3.5 w-3.5 text-gold" aria-label="Has quiz" />}
      {lesson.preview_allowed && (
        <Badge variant="outline" className="text-[10px]">
          Preview
        </Badge>
      )}
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

// ================= Lesson editor drawer (Dialog) =================

function LessonEditor({
  courseId,
  lesson,
  quizzes,
  onClose,
  onChanged,
}: {
  courseId: string;
  lesson: {
    id: string;
    title: string;
    description: string | null;
    video_url: string | null;
    duration_seconds: number | null;
    preview_allowed: boolean;
    resources: unknown;
  };
  quizzes: { id: string; title: string; lesson_id: string | null }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const update = useServerFn(updateLesson);
  const del = useServerFn(deleteLesson);
  const createQz = useServerFn(createQuizInline);
  const attachQz = useServerFn(attachQuizToLesson);

  const [title, setTitle] = useState(lesson.title);
  const [desc, setDesc] = useState(lesson.description ?? "");
  const [preview, setPreview] = useState(lesson.preview_allowed);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const [duration, setDuration] = useState(lesson.duration_seconds ?? 0);
  const [resources, setResources] = useState<Resource[]>(
    Array.isArray(lesson.resources) ? (lesson.resources as Resource[]) : [],
  );
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [resProgress, setResProgress] = useState<number | null>(null);
  const [newQuizTitle, setNewQuizTitle] = useState("");

  const attachedQuiz = quizzes.find((q) => q.lesson_id === lesson.id) ?? null;
  const availableQuizzes = quizzes.filter((q) => !q.lesson_id || q.lesson_id === lesson.id);

  const save = () =>
    update({
      data: {
        id: lesson.id,
        title,
        description: desc,
        video_url: videoUrl || null,
        duration_seconds: Number(duration) || 0,
        preview_allowed: preview,
        resources,
      },
    }).then(() => {
      toast.success("Lesson saved");
      onChanged();
      onClose();
    });

  const uploadVideo = async (file: File) => {
    setVideoProgress(0);
    try {
      const { path } = await uploadToBucket({
        bucket: "course-media",
        file,
        pathPrefix: `courses/${courseId}/lessons/${lesson.id}/video`,
        onProgress: setVideoProgress,
      });
      setVideoUrl(path);
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setVideoProgress(null);
    }
  };

  const uploadResource = async (file: File) => {
    setResProgress(0);
    try {
      const { path, kind } = await uploadToBucket({
        bucket: "course-media",
        file,
        pathPrefix: `courses/${courseId}/lessons/${lesson.id}/resources`,
        onProgress: setResProgress,
      });
      setResources((r) => [
        ...r,
        { id: crypto.randomUUID(), name: file.name, url: path, kind, size: file.size },
      ]);
      toast.success("Resource attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setResProgress(null);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit lesson</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </div>

          <div className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                <Video className="h-4 w-4" /> Video
              </Label>
              <label className="cursor-pointer text-xs text-primary hover:underline">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
                />
                Upload
              </label>
            </div>
            <Input
              className="mt-2"
              placeholder="https://videos.example.com/lesson.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            {videoProgress !== null && <Progress value={videoProgress} className="mt-2" />}
            <div className="mt-2 flex items-center gap-2">
              <Label className="text-xs">Duration (sec)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                <FileText className="h-4 w-4" /> Resources (PDF/PPT)
              </Label>
              <label className="cursor-pointer text-xs text-primary hover:underline">
                <input
                  type="file"
                  accept=".pdf,.ppt,.pptx,.doc,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadResource(e.target.files[0])}
                />
                <Upload className="mr-1 inline h-3 w-3" /> Add
              </label>
            </div>
            {resProgress !== null && <Progress value={resProgress} className="mt-2" />}
            <ul className="mt-2 space-y-1">
              {resources.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs"
                >
                  <span className="truncate">
                    {r.name} <span className="text-muted-foreground">({r.kind})</span>
                  </span>
                  <button
                    className="text-destructive hover:underline"
                    onClick={() => setResources((rs) => rs.filter((x) => x.id !== r.id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {resources.length === 0 && (
                <li className="text-xs text-muted-foreground">No resources attached</li>
              )}
            </ul>
          </div>

          <div className="rounded-md border border-border p-3">
            <Label className="flex items-center gap-1">
              <Wand2 className="h-4 w-4" /> Quiz
            </Label>
            {attachedQuiz ? (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm">{attachedQuiz.title}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    attachQz({ data: { quizId: attachedQuiz.id, lessonId: null } }).then(onChanged)
                  }
                >
                  Detach
                </Button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <Select
                  onValueChange={(id) =>
                    attachQz({ data: { quizId: id, lessonId: lesson.id } }).then(onChanged)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Attach existing quiz…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQuizzes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.title}
                      </SelectItem>
                    ))}
                    {availableQuizzes.length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground">No quizzes</div>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    placeholder="Or create new quiz…"
                    value={newQuizTitle}
                    onChange={(e) => setNewQuizTitle(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newQuizTitle.trim())
                        createQz({
                          data: { courseId, lessonId: lesson.id, title: newQuizTitle },
                        }).then(() => {
                          setNewQuizTitle("");
                          onChanged();
                          toast.success("Quiz created");
                        });
                    }}
                  >
                    Create
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch id="preview-lesson" checked={preview} onCheckedChange={setPreview} />
            <Label htmlFor="preview-lesson" className="text-sm">
              Preview allowed (viewable without enrollment)
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-4 justify-between sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Delete this lesson?"))
                del({ data: { id: lesson.id } }).then(() => {
                  onChanged();
                  onClose();
                });
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>
              <Save className="mr-1 h-4 w-4" /> Save lesson
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================= Assignments tab =================

function Assignments({
  courseId,
  lessons,
  assignments,
  onChanged,
}: {
  courseId: string;
  lessons: { id: string; title: string }[];
  assignments: {
    id: string;
    title: string;
    instructions: string | null;
    rubric: string | null;
    due_at: string | null;
    allow_late: boolean;
    max_score: number;
    lesson_id: string | null;
  }[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const del = useServerFn(deleteAssignment);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="mr-1 h-4 w-4" /> New Assignment
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.due_at ? `Due ${new Date(a.due_at).toLocaleString()}` : "No due date"} · Max{" "}
                {a.max_score} · {a.allow_late ? "Late OK" : "No late"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(a.id)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Delete assignment?")) del({ data: { id: a.id } }).then(onChanged);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
        {assignments.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">No assignments yet.</li>
        )}
      </ul>

      {editing && (
        <AssignmentEditor
          courseId={courseId}
          lessons={lessons}
          assignment={
            editing === "new" ? null : (assignments.find((a) => a.id === editing) ?? null)
          }
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AssignmentEditor({
  courseId,
  lessons,
  assignment,
  onClose,
  onSaved,
}: {
  courseId: string;
  lessons: { id: string; title: string }[];
  assignment: {
    id: string;
    title: string;
    instructions: string | null;
    rubric: string | null;
    due_at: string | null;
    allow_late: boolean;
    max_score: number;
    lesson_id: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertAssignment);
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [instructions, setInstructions] = useState(assignment?.instructions ?? "");
  const [rubric, setRubric] = useState(assignment?.rubric ?? "");
  const [dueAt, setDueAt] = useState(assignment?.due_at ? assignment.due_at.slice(0, 16) : "");
  const [allowLate, setAllowLate] = useState(assignment?.allow_late ?? true);
  const [maxScore, setMaxScore] = useState(assignment?.max_score ?? 100);
  const [lessonId, setLessonId] = useState(assignment?.lesson_id ?? "");

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: assignment?.id,
          course_id: courseId,
          lesson_id: lessonId || null,
          title,
          instructions,
          rubric,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          allow_late: allowLate,
          max_score: maxScore,
        },
      }),
    onSuccess: () => {
      toast.success("Assignment saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment ? "Edit" : "New"} assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div>
            <Label>Rubric</Label>
            <Textarea
              rows={4}
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder="Criteria and scoring guide"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due date</Label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Max score</Label>
              <Input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <Label>Attach to lesson (optional)</Label>
            <Select value={lessonId} onValueChange={setLessonId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {lessons.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="allow-late" checked={allowLate} onCheckedChange={setAllowLate} />
            <Label htmlFor="allow-late" className="text-sm">
              Allow late submissions
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={title.trim().length < 2 || mut.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
