import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit-logs")({
  component: AuditLogs,
});

function AuditLogs() {
  const { data } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Administration</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete record of authentication events, role changes, and privileged actions.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">When</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{log.actor_email ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{log.target ?? "—"}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><ScrollText className="mx-auto mb-2 h-6 w-6" />No events recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
