import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getUserActivityProfile } from "@/lib/admin.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth-helpers";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatusPill } from "@/components/admin/status-pill";
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  formatDuration,
  summarizeUserAgent,
  formatLocation,
  formatActionLabel,
} from "@/lib/activity-format";
import { ArrowLeft, ScrollText, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users/$userId")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(getUserActivityProfile);
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["admin-user-profile", userId],
      queryFn: () => fn({ data: { userId } }),
    }),
  );

  const { employee, roles, isOnline, lastLogin, sessions, activityLog } = data;
  const centerName = (employee as { centers?: { name: string } | null }).centers?.name ?? "—";
  const orgName =
    (employee as { organizations?: { name: string } | null }).organizations?.name ?? "—";

  return (
    <div className="space-y-6">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Users
      </Link>

      <AdminHeader
        title={employee.full_name}
        description={employee.email}
        showTabs={false}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill tone={isOnline ? "success" : "neutral"}>
              {isOnline ? "Online" : "Offline"}
            </StatusPill>
            <DeleteUserDialog
              userId={userId}
              userEmail={employee.email}
              userName={employee.full_name}
              onDeleted={() => navigate({ to: "/admin/users" })}
              trigger={
                <Button size="sm" variant="destructive">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete user
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Status" value={employee.status} />
        <SummaryCard
          label="Role(s)"
          value={roles.length ? roles.map((r) => ROLE_LABELS[r as AppRole] ?? r).join(", ") : "—"}
        />
        <SummaryCard
          label="Last login"
          value={lastLogin ? new Date(lastLogin.loginAt).toLocaleString() : "Never"}
        />
        <SummaryCard
          label="Last logout"
          value={
            lastLogin?.logoutAt
              ? new Date(lastLogin.logoutAt).toLocaleString()
              : isOnline
                ? "Still active"
                : "—"
          }
        />
      </div>

      <Tabs defaultValue="registration" className="w-full">
        <TabsList>
          <TabsTrigger value="registration">Registration Details</TabsTrigger>
          <TabsTrigger value="logins">Login History</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="registration" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Full name" value={employee.full_name} />
              <Field label="Email" value={employee.email} />
              <Field label="Phone" value={employee.phone ?? "—"} />
              <Field label="Designation" value={employee.designation ?? "—"} />
              <Field label="Employee code" value={employee.employee_code ?? "—"} />
              <Field
                label="Primary role"
                value={
                  employee.primary_role
                    ? (ROLE_LABELS[employee.primary_role as AppRole] ?? employee.primary_role)
                    : "—"
                }
              />
              <Field label="Organization" value={orgName} />
              <Field label="Center" value={centerName} />
              <Field
                label="Learning interests"
                value={
                  Array.isArray(employee.learning_interests) && employee.learning_interests.length
                    ? employee.learning_interests.join(", ")
                    : "—"
                }
              />
              <Field
                label="Account created"
                value={employee.created_at ? new Date(employee.created_at).toLocaleString() : "—"}
              />
              <Field
                label="Onboarding completed"
                value={
                  employee.onboarding_completed_at
                    ? new Date(employee.onboarding_completed_at).toLocaleString()
                    : "Not completed (admin-created account)"
                }
              />
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="logins" className="mt-4">
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Logged in</th>
                  <th className={TH}>Logged out</th>
                  <th className={TH}>Duration</th>
                  <th className={TH}>IP address</th>
                  <th className={TH}>Location</th>
                  <th className={TH}>Device / Browser</th>
                  <th className={TH}>Method</th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {sessions.map((s, i) => (
                  <tr key={`${s.loginAt}-${i}`} className={TR}>
                    <td className={`${TD} whitespace-nowrap`}>
                      {new Date(s.loginAt).toLocaleString()}
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
                    <td className={`${TD_MUTED} whitespace-nowrap font-mono text-xs`}>
                      {s.ip ?? "—"}
                    </td>
                    <td className={`${TD_MUTED} whitespace-nowrap text-xs`}>
                      {formatLocation(s.city, s.country)}
                    </td>
                    <td className={`${TD_MUTED} whitespace-nowrap text-xs`}>
                      {summarizeUserAgent(s.userAgent)}
                    </td>
                    <td className={`${TD_MUTED} whitespace-nowrap text-xs`}>{s.method ?? "—"}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className={EMPTY_ROW}>
                      No login history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>When</th>
                  <th className={TH}>Action</th>
                  <th className={TH}>Target</th>
                  <th className={TH}>IP address</th>
                  <th className={TH}>Details</th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {activityLog
                  .filter((a) => a.action !== "login_success" && a.action !== "logout")
                  .map((a) => {
                    const metadata = a.metadata ?? {};
                    const {
                      user_agent: _ua,
                      city: _city,
                      country: _country,
                      region: _region,
                      ...rest
                    } = metadata as Record<string, unknown>;
                    const details = Object.keys(rest).length ? JSON.stringify(rest) : null;
                    return (
                      <tr key={a.id} className={TR}>
                        <td className={`${TD_MUTED} whitespace-nowrap`}>
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className={TD}>{formatActionLabel(a.action)}</td>
                        <td className={`${TD_MUTED} text-xs`}>{a.target ?? "—"}</td>
                        <td className={`${TD_MUTED} whitespace-nowrap font-mono text-xs`}>
                          {a.ip ?? "—"}
                        </td>
                        <td
                          className={`${TD_MUTED} max-w-xs truncate text-xs`}
                          title={details ?? ""}
                        >
                          {details ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                {activityLog.filter((a) => a.action !== "login_success" && a.action !== "logout")
                  .length === 0 && (
                  <tr>
                    <td colSpan={5} className={EMPTY_ROW}>
                      <ScrollText className="mx-auto mb-2 h-6 w-6" />
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
