import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { publishAnnouncement } from "@/lib/admin.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const fn = useServerFn(publishAnnouncement);
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", body: "" });
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["announcements-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("published_at", { ascending: false });
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fn({ data: form });
      toast.success("Announcement published");
      setForm({ title: "", body: "" });
      qc.invalidateQueries({ queryKey: ["announcements-admin"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Administration</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Announcements</h1>
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required maxLength={4000} rows={4} />
        </div>
        <div>
          <Button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish"}</Button>
        </div>
      </form>

      <div className="space-y-3">
        {(data ?? []).map((a) => (
          <div key={a.id} className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
            <Megaphone className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(a.published_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
