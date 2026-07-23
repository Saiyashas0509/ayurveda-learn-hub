import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin/admin-header";
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
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit-logs")({
  component: AuditLogs,
});

function AuditLogs() {
  const { data } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Audit Logs"
        description="Complete record of authentication events, role changes, and privileged actions."
      />

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>When</th>
              <th className={TH}>Actor</th>
              <th className={TH}>Action</th>
              <th className={TH}>Target</th>
            </tr>
          </thead>
          <tbody className={TBODY}>
            {(data ?? []).map((log) => (
              <tr key={log.id} className={TR}>
                <td className={`${TD_MUTED} whitespace-nowrap`}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className={TD}>{log.actor_email ?? "—"}</td>
                <td className={`${TD} font-mono text-xs`}>{log.action}</td>
                <td className={`${TD_MUTED} text-xs`}>{log.target ?? "—"}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={4} className={EMPTY_ROW}>
                  <ScrollText className="mx-auto mb-2 h-6 w-6" />
                  No events recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
