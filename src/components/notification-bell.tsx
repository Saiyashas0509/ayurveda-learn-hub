import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyNotifications, markRead, markAllRead } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationBell() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markRead);
  const markAllFn = useServerFn(markAllRead);

  const { data, refetch } = useQuery({
    queryKey: ["notifs-bell"],
    queryFn: () => listFn({ data: { limit: 10 } }),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    let userId: string | undefined;
    let ch: ReturnType<typeof supabase.channel> | undefined;
    supabase.auth.getUser().then(({ data: u }) => {
      userId = u.user?.id;
      if (!userId) return;
      ch = supabase.channel(`notifs:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => refetch())
        .subscribe();
    });
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [refetch]);

  const markAll = useMutation({ mutationFn: () => markAllFn(), onSuccess: () => refetch() });

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-2 hover:bg-accent" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>Mark all read</Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>}
          {items.map((n) => (
            <button key={n.id} onClick={() => {
              markFn({ data: { ids: [n.id], read: true } }).then(() => refetch());
              if (n.link) navigate({ to: n.link });
            }} className={`block w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-accent/40 ${n.is_read ? "" : "bg-primary/5"}`}>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/notifications" })}>See all</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
