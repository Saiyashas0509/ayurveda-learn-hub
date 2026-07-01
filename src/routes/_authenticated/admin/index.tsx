import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin.functions";
import { Users, BookOpen, ClipboardCheck, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const fn = useServerFn(getAdminOverview);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["admin-overview"], queryFn: () => fn() }),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Administration</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Overview</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Employees" value={data.employees} />
        <Stat icon={BookOpen} label="Courses" value={data.courses} />
        <Stat icon={ClipboardCheck} label="Quiz attempts" value={data.attempts} />
        <Stat icon={Award} label="Certificates issued" value={data.certificates} />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">Recent audit events</h2>
        </div>
        <ul className="divide-y divide-border">
          {data.recentLogs.map((log) => (
            <li key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{log.action}</p>
                <p className="text-xs text-muted-foreground">{log.actor_email ?? "system"} · {log.target ?? "—"}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
            </li>
          ))}
          {data.recentLogs.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No events yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
