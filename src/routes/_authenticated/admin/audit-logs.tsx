import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listLoginActivity } from "@/lib/admin.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth-helpers";
import { AdminHeader } from "@/components/admin/admin-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  TABLE_WRAP,
  TABLE,
  THEAD,
  TH,
  TBODY,
  TR,
  TD,
  TD_MUTED,
  EMPTY_ROW,
} from "@/components/admin/table";
import { ScrollText, LogIn } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit-logs")({
  component: AuditLogs,
});

function AuditLogs() {
  return (
    <div className="space-y-6">
      <AdminHeader
        title="Audit Logs"
        description="Complete record of authentication events, role changes, and privileged actions."
      />

      <Tabs defaultValue="login-activity" className="w-full">
        <TabsList>
          <TabsTrigger value="login-activity">Login Activity</TabsTrigger>
          <TabsTrigger value="all-events">All Events</TabsTrigger>
        </TabsList>

        <TabsContent value="login-activity" className="mt-4">
          <LoginActivity />
        </TabsContent>

        <TabsContent value="all-events" className="mt-4">
          <AllEvents />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

// Lightweight UA -> "Browser on OS" summary. Not exhaustive, just readable —
// good enough for an admin activity log, not a full device-detection library.
function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "—";
  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/crios\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";
  else if (/opr\//i.test(ua)) browser = "Opera";

  return `${browser} on ${os}`;
}

function LoginActivity() {
  const fn = useServerFn(listLoginActivity);
  const { data, isLoading } = useQuery({
    queryKey: ["login-activity"],
    queryFn: () => fn(),
  });

  return (
    <div className={TABLE_WRAP}>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>Person</th>
            <th className={TH}>Role</th>
            <th className={TH}>Logged in</th>
            <th className={TH}>Logged out</th>
            <th className={TH}>Duration</th>
            <th className={TH}>IP address</th>
            <th className={TH}>Device / Browser</th>
          </tr>
        </thead>
        <tbody className={TBODY}>
          {(data ?? []).map((s, i) => (
            <tr key={`${s.email}-${s.loginAt}-${i}`} className={TR}>
              <td className={TD}>
                <p className="font-medium">{s.fullName ?? s.email}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </td>
              <td className={TD}>
                {s.role ? (
                  <Badge variant="outline" className="text-xs">
                    {ROLE_LABELS[s.role as AppRole] ?? s.role}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td className={`${TD} whitespace-nowrap`}>
                {new Date(s.loginAt).toLocaleString()}
                {s.method && (
                  <span className="ml-1.5 text-xs text-muted-foreground">({s.method})</span>
                )}
              </td>
              <td className={`${TD} whitespace-nowrap`}>
                {s.logoutAt ? (
                  new Date(s.logoutAt).toLocaleString()
                ) : (
                  <Badge className="text-xs">Still active</Badge>
                )}
              </td>
              <td className={`${TD_MUTED} whitespace-nowrap`}>
                {s.logoutAt ? formatDuration(s.loginAt, s.logoutAt) : "—"}
              </td>
              <td className={`${TD_MUTED} whitespace-nowrap font-mono text-xs`}>{s.ip ?? "—"}</td>
              <td className={`${TD_MUTED} whitespace-nowrap text-xs`}>
                {summarizeUserAgent(s.userAgent)}
              </td>
            </tr>
          ))}
          {!isLoading && (!data || data.length === 0) && (
            <tr>
              <td colSpan={7} className={EMPTY_ROW}>
                <LogIn className="mx-auto mb-2 h-6 w-6" />
                No login activity recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AllEvents() {
  const { data } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  return (
    <div className={TABLE_WRAP}>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>When</th>
            <th className={TH}>Actor</th>
            <th className={TH}>Action</th>
            <th className={TH}>Target</th>
            <th className={TH}>IP address</th>
            <th className={TH}>Details</th>
          </tr>
        </thead>
        <tbody className={TBODY}>
          {(data ?? []).map((log) => {
            const metadata = (log.metadata ?? {}) as Record<string, unknown>;
            const { user_agent: _ua, ...rest } = metadata;
            const details = Object.keys(rest).length ? JSON.stringify(rest) : null;
            return (
              <tr key={log.id} className={TR}>
                <td className={`${TD_MUTED} whitespace-nowrap`}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className={TD}>{log.actor_email ?? "—"}</td>
                <td className={`${TD} font-mono text-xs`}>{log.action}</td>
                <td className={`${TD_MUTED} text-xs`}>{log.target ?? "—"}</td>
                <td className={`${TD_MUTED} whitespace-nowrap font-mono text-xs`}>
                  {log.ip ?? "—"}
                </td>
                <td className={`${TD_MUTED} max-w-xs truncate text-xs`} title={details ?? ""}>
                  {details ?? "—"}
                </td>
              </tr>
            );
          })}
          {(!data || data.length === 0) && (
            <tr>
              <td colSpan={6} className={EMPTY_ROW}>
                <ScrollText className="mx-auto mb-2 h-6 w-6" />
                No events recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
