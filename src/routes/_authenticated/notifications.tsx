import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listMyNotifications, markRead, markAllRead, NOTIF_TYPES } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Bell, FileText, Award, Video, Megaphone, MessageSquare, Cog } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

const ICONS: Record<string, typeof Bell> = {
  assignment: FileText, result: Award, live_class: Video,
  announcement: Megaphone, discussion: MessageSquare, system: Cog,
};

function Page() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const listFn = useServerFn(listMyNotifications);
  const { data, refetch } = useQuery({
    queryKey: ["notifs"], queryFn: () => listFn({ data: { limit: 100 } }),
  });
  const markFn = useServerFn(markRead);
  const markAllFn = useServerFn(markAllRead);
  const mark = useMutation({
    mutationFn: (v: { ids: string[]; read: boolean }) => markFn({ data: v }),
    onSuccess: () => refetch(),
  });
  const markAll = useMutation({ mutationFn: () => markAllFn(), onSuccess: () => refetch() });

  const items = (data?.items ?? []).filter((n) => filter === "all" || n.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{data?.unreadCount ?? 0} unread</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => markAll.mutate()}>Mark all read</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...NOTIF_TYPES].map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === t ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {t === "all" ? "All" : t.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No notifications.</p>}
        {items.map((n) => {
          const Icon = ICONS[n.type] ?? Bell;
          return (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${n.is_read ? "" : "bg-primary/5"}`}>
              <Icon className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-col gap-1">
                {n.link && <Button size="sm" variant="ghost" onClick={() => { mark.mutate({ ids: [n.id], read: true }); navigate({ to: n.link! }); }}>Open</Button>}
                <Button size="sm" variant="ghost" onClick={() => mark.mutate({ ids: [n.id], read: !n.is_read })}>
                  {n.is_read ? "Mark unread" : "Mark read"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
