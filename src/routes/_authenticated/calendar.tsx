import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { listCalendarEvents, exportEventIcs, type CalEvent } from "@/lib/calendar.functions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

const COLOR: Record<CalEvent["type"], string> = {
  live_class: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  assignment: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  quiz: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

function Page() {
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState<"month" | "week">("month");
  const navigate = useNavigate();

  const range = useMemo(() => {
    if (mode === "week") {
      const s = startOfWeek(cursor); const e = endOfWeek(cursor);
      return { from: s, to: e };
    }
    const s = startOfWeek(startOfMonth(cursor));
    const e = endOfWeek(endOfMonth(cursor));
    return { from: s, to: e };
  }, [cursor, mode]);

  const listFn = useServerFn(listCalendarEvents);
  const { data: events = [] } = useQuery({
    queryKey: ["cal", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => listFn({ data: { from: range.from.toISOString(), to: range.to.toISOString() } }),
  });
  const icsFn = useServerFn(exportEventIcs);
  async function download(e: CalEvent) {
    if (e.type === "quiz") return;
    const r = await icsFn({ data: { type: e.type, id: e.id } });
    const blob = new Blob([r.content], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
  }

  const days: Date[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">Live classes, assignments, quiz deadlines.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCursor(mode === "week" ? addDays(cursor, -7) : addMonths(cursor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-40 text-center text-sm font-medium">{format(cursor, mode === "week" ? "'Week of' MMM d, yyyy" : "MMMM yyyy")}</div>
          <Button size="sm" variant="outline" onClick={() => setCursor(mode === "week" ? addDays(cursor, 7) : addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant={mode === "month" ? "default" : "outline"} onClick={() => setMode("month")}>Month</Button>
          <Button size="sm" variant={mode === "week" ? "default" : "outline"} onClick={() => setMode("week")}>Week</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">{d}</div>
        ))}
        {days.map((d) => {
          const inMonth = mode === "week" || isSameMonth(d, cursor);
          const dayEvents = events.filter((e) => isSameDay(new Date(e.start), d));
          return (
            <div key={d.toISOString()} className={`min-h-28 bg-card p-1.5 ${inMonth ? "" : "opacity-40"}`}>
              <div className={`text-xs ${isSameDay(d, new Date()) ? "font-bold text-primary" : "text-muted-foreground"}`}>{format(d, "d")}</div>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 4).map((e) => (
                  <div key={`${e.type}-${e.id}`} className={`group flex items-center justify-between gap-1 rounded border px-1.5 py-0.5 text-[11px] ${COLOR[e.type]}`}>
                    <button onClick={() => navigate({ to: e.link })} className="truncate text-left">{format(new Date(e.start), "HH:mm")} {e.title}</button>
                    {e.type !== "quiz" && (
                      <button onClick={() => download(e)} className="opacity-0 group-hover:opacity-100" title="Download .ics">
                        <Download className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {dayEvents.length > 4 && <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 4} more</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-500/40" /> Live class</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500/40" /> Assignment</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-violet-500/40" /> Quiz</span>
      </div>
    </div>
  );
}
