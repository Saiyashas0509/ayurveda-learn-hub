import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPreferences, updatePreferences, NOTIF_TYPES } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

const LABELS: Record<string, string> = {
  assignment: "Assignments", result: "Results & grading", live_class: "Live classes",
  announcement: "Announcements", discussion: "Discussion replies", system: "System messages",
};

function Page() {
  const getFn = useServerFn(getPreferences);
  const updateFn = useServerFn(updatePreferences);
  const { data, refetch } = useQuery({ queryKey: ["prefs"], queryFn: () => getFn() });
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => { if (data?.in_app) setPrefs(data.in_app as Record<string, boolean>); }, [data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: { inApp: prefs, emailEnabled: false, smsEnabled: false } }),
    onSuccess: () => refetch(),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Notification preferences</h1>
        <p className="text-sm text-muted-foreground">Control what you receive in the app.</p>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {NOTIF_TYPES.map((t) => (
          <div key={t} className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">{LABELS[t]}</p>
              <p className="text-xs text-muted-foreground">In-app bell + full page</p>
            </div>
            <Switch checked={prefs[t] ?? true} onCheckedChange={(v) => setPrefs({ ...prefs, [t]: v })} />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
        <p className="text-sm font-medium">Email & SMS delivery</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Email notifications</p>
            <p className="text-xs text-muted-foreground">Requires domain verification</p>
          </div>
          <Switch disabled />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">SMS notifications</p>
            <p className="text-xs text-muted-foreground">Requires domain verification</p>
          </div>
          <Switch disabled />
        </div>
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>Save preferences</Button>
    </div>
  );
}
