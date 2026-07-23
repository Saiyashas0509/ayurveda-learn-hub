import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatTile } from "@/components/admin/stat-tile";
import {
  Users,
  BookOpen,
  ClipboardCheck,
  Award,
  UserCheck,
  UserX,
  Video,
  TrendingUp,
} from "lucide-react";

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
      <AdminHeader
        title="Overview"
        description="Platform-wide activity across employees, courses, and live operations."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Employees"
          value={data.employees}
          sub={`+${data.newThisWeek} this week`}
        />
        <StatTile icon={UserCheck} label="Active" value={data.activeEmployees} tone="success" />
        <StatTile
          icon={UserX}
          label="Disabled"
          value={data.disabledEmployees}
          tone={data.disabledEmployees > 0 ? "danger" : "default"}
        />
        <StatTile icon={BookOpen} label="Courses" value={data.courses} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={ClipboardCheck}
          label="Pending submissions"
          value={data.pendingSubmissions}
          tone={data.pendingSubmissions > 0 ? "warning" : "default"}
        />
        <StatTile icon={TrendingUp} label="Graded submissions" value={data.gradedSubmissions} />
        <StatTile icon={Video} label="Upcoming live classes" value={data.upcomingLiveClasses} />
        <StatTile icon={Award} label="Certificates issued" value={data.certificates} />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent audit events
          </h2>
        </div>
        <ul className="divide-y divide-border">
          {data.recentLogs.map((log) => (
            <li key={log.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-mono text-[13px]">{log.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {log.actor_email ?? "system"} · {log.target ?? "—"}
                </p>
              </div>
              <span className="shrink-0 pl-4 text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </li>
          ))}
          {data.recentLogs.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">No events yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
