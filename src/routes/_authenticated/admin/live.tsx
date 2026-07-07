import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scheduleClass, listLiveClasses } from "@/lib/live-classes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/live")({
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function Page() {
  const { data: courses = [] } = useQuery({
    queryKey: ["my-courses-authored"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,title").order("title");
      return data ?? [];
    },
  });

  const listFn = useServerFn(listLiveClasses);
  const { data: classes = [], refetch } = useQuery({
    queryKey: ["live-all"], queryFn: () => listFn({ data: { scope: "all" } }),
  });

  const scheduleFn = useServerFn(scheduleClass);
  const [form, setForm] = useState({
    courseId: "", title: "", description: "", meetingUrl: "",
    provider: "meet" as "zoom" | "meet" | "teams" | "other",
    startsAt: "", endsAt: "",
  });
  const create = useMutation({
    mutationFn: () => scheduleFn({ data: {
      courseId: form.courseId, title: form.title, description: form.description || undefined,
      meetingUrl: form.meetingUrl, provider: form.provider,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    } }),
    onSuccess: () => { setForm({ ...form, title: "", description: "", meetingUrl: "", startsAt: "", endsAt: "" }); refetch(); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Schedule Live Class</h1>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-2">
        <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v })}>
          <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
          <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea placeholder="Description" className="md:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input placeholder="Meeting URL (Zoom/Meet/Teams)" value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} />
        <Select value={form.provider} onValueChange={(v: "zoom" | "meet" | "teams" | "other") => setForm({ ...form, provider: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="zoom">Zoom</SelectItem>
            <SelectItem value="meet">Google Meet</SelectItem>
            <SelectItem value="teams">Microsoft Teams</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <label className="text-xs">Starts at <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
        <label className="text-xs">Ends at <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
        <div className="md:col-span-2">
          <Button onClick={() => create.mutate()} disabled={!form.courseId || !form.title || !form.meetingUrl || !form.startsAt}>Schedule</Button>
        </div>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        <div className="p-4 font-medium">All classes</div>
        {classes.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(c.starts_at).toLocaleString()} · {c.provider}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
