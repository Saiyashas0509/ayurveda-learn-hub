import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scheduleClass, listLiveClassesAdmin, cancelClass } from "@/lib/live-classes.functions";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatusPill } from "@/components/admin/status-pill";
import { toast } from "sonner";
import { Search, Users, ChevronLeft, ChevronRight, X, CalendarPlus, Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/live")({
  component: Page,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

const PAGE_SIZE = 20;
const PROVIDER_LABELS: Record<string, string> = {
  zoom: "Zoom",
  meet: "Google Meet",
  teams: "Microsoft Teams",
  other: "Other",
};

function Page() {
  const { data: courses = [] } = useQuery({
    queryKey: ["my-courses-authored"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,title").order("title");
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const [provider, setProvider] = useState<"zoom" | "meet" | "teams" | "other" | "all">("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const listFn = useServerFn(listLiveClassesAdmin);
  const qc = useQueryClient();
  const queryKey = ["live-admin", { debouncedSearch, scope, provider, page }];
  const { data, isLoading, isFetching } = useQuery(
    queryOptions({
      queryKey,
      queryFn: () =>
        listFn({
          data: {
            scope,
            provider,
            search: debouncedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
          },
        }),
      placeholderData: (prev) => prev,
    }),
  );
  const classes = data?.rows ?? [];
  const pageCount = data?.pageCount ?? 1;

  const scheduleFn = useServerFn(scheduleClass);
  const cancelFn = useServerFn(cancelClass);
  const [form, setForm] = useState({
    courseId: "",
    title: "",
    description: "",
    meetingUrl: "",
    provider: "meet" as "zoom" | "meet" | "teams" | "other",
    startsAt: "",
    endsAt: "",
  });
  const create = useMutation({
    mutationFn: () =>
      scheduleFn({
        data: {
          courseId: form.courseId,
          title: form.title,
          description: form.description || undefined,
          meetingUrl: form.meetingUrl,
          provider: form.provider,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      setForm({ ...form, title: "", description: "", meetingUrl: "", startsAt: "", endsAt: "" });
      setFormOpen(false);
      toast.success("Class scheduled");
      qc.invalidateQueries({ queryKey: ["live-admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to schedule"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Class cancelled");
      qc.invalidateQueries({ queryKey: ["live-admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to cancel"),
  });

  const now = Date.now();

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Live Classes"
        description={`${data?.total ?? 0} class${data?.total === 1 ? "" : "es"} scheduled across all courses.`}
        actions={
          <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
            <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> {formOpen ? "Close" : "Schedule class"}
          </Button>
        }
      />

      {formOpen && (
        <div className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-card md:grid-cols-2">
          <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            placeholder="Description"
            className="md:col-span-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            placeholder="Meeting URL (Zoom/Meet/Teams)"
            value={form.meetingUrl}
            onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
          />
          <Select
            value={form.provider}
            onValueChange={(v: "zoom" | "meet" | "teams" | "other") =>
              setForm({ ...form, provider: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="meet">Google Meet</SelectItem>
              <SelectItem value="teams">Microsoft Teams</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <label className="text-xs">
            Starts at{" "}
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Ends at{" "}
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </label>
          <div className="md:col-span-2">
            <Button
              onClick={() => create.mutate()}
              disabled={
                !form.courseId ||
                !form.title ||
                !form.meetingUrl ||
                !form.startsAt ||
                create.isPending
              }
            >
              {create.isPending ? "Scheduling…" : "Schedule"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={scope}
          onValueChange={(v) => {
            setScope(v as typeof scope);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={provider}
          onValueChange={(v) => {
            setProvider(v as typeof provider);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            <SelectItem value="zoom">Zoom</SelectItem>
            <SelectItem value="meet">Google Meet</SelectItem>
            <SelectItem value="teams">Microsoft Teams</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="divide-y divide-border">
          {classes.map((c) => {
            const started = new Date(c.starts_at).getTime() <= now;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(c.starts_at).toLocaleString()} ·{" "}
                      {PROVIDER_LABELS[c.provider] ?? c.provider} ·{" "}
                      {(c.courses as { title?: string } | null)?.title ?? ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill tone={started ? "neutral" : "info"}>
                    {started ? "Held" : "Scheduled"}
                  </StatusPill>
                  <StatusPill tone="neutral" dot={false}>
                    <Users className="h-3 w-3" /> {c.attendeeCount}
                  </StatusPill>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Cancel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel "{c.title}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the class permanently. Attendees will lose access to the
                          meeting link. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep class</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancel.mutate(c.id)}>
                          Cancel class
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
          {!isLoading && classes.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No classes match these filters.
            </div>
          )}
        </div>
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
    </div>
  );
}
