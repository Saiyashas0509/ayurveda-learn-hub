import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { listLiveClasses } from "@/lib/live-classes.functions";
import { exportEventIcs } from "@/lib/calendar.functions";
import { Video, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const search = z.object({
  scope: fallback(z.enum(["upcoming", "past", "all"]), "upcoming").default("upcoming"),
  courseId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/live/")({
  validateSearch: zodValidator(search),
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function Page() {
  const { scope, courseId } = Route.useSearch();
  const listFn = useServerFn(listLiveClasses);
  const { data = [] } = useQuery({
    queryKey: ["live", scope, courseId ?? "all"],
    queryFn: () => listFn({ data: { scope, courseId } }),
  });
  const icsFn = useServerFn(exportEventIcs);

  async function downloadIcs(id: string) {
    const r = await icsFn({ data: { type: "live_class", id } });
    const blob = new Blob([r.content], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Live Classes</h1>
        <p className="text-sm text-muted-foreground">Scheduled sessions across your enrolled courses.</p>
      </div>

      <div className="flex gap-2">
        {(["upcoming", "past", "all"] as const).map((s) => (
          <Link key={s} to="/live" search={(prev: { scope?: string; courseId?: string }) => ({ ...prev, scope: s })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${scope === s ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {data.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No classes.</p>}
        {data.map((c) => (
          <div key={c.id} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Video className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                {(c.courses as { title?: string } | null)?.title ?? "Course"} · {new Date(c.starts_at).toLocaleString()} · {c.provider}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => downloadIcs(c.id)}><Download className="h-4 w-4" /> .ics</Button>
            <Link to="/live/$id" params={{ id: c.id }} className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Open</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
