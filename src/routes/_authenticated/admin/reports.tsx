import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getLearnerProgressReport,
  getAttendanceReport,
  getOrgStatsReport,
  getComplianceLogReport,
} from "@/lib/reports.functions";
import { exportReportToExcel, exportReportToPdf, type ReportColumn } from "@/lib/report-export";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <AdminHeader
        title="Reports"
        description="Exportable reports for learner progress, attendance, organization stats, and compliance logs."
      />
      <Tabs defaultValue="progress" className="w-full">
        <TabsList>
          <TabsTrigger value="progress">Learner Progress</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="org">Org Stats & Ratings</TabsTrigger>
          <TabsTrigger value="compliance">Compliance / Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="progress" className="mt-4">
          <LearnerProgressTab />
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="org" className="mt-4">
          <OrgStatsTab />
        </TabsContent>
        <TabsContent value="compliance" className="mt-4">
          <ComplianceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({
  title,
  columns,
  rows,
  filename,
  isLoading,
}: {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  filename: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="text-sm text-muted-foreground">{rows.length} rows</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.length}
            onClick={() => exportReportToExcel(rows, columns, filename)}
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Export Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.length}
            onClick={() => exportReportToPdf(rows, columns, title, filename)}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{String(row[c.key] ?? "")}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

const PROGRESS_COLUMNS: ReportColumn[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "center", label: "Center" },
  { key: "organization", label: "Organization" },
  { key: "lessonsStarted", label: "Lessons Started" },
  { key: "lessonsCompleted", label: "Lessons Completed" },
  { key: "certificatesEarned", label: "Certificates" },
];

function LearnerProgressTab() {
  const fn = useServerFn(getLearnerProgressReport);
  const { data, isLoading } = useQuery({ queryKey: ["report-progress"], queryFn: () => fn() });
  return (
    <ReportCard
      title="Learner Progress"
      columns={PROGRESS_COLUMNS}
      rows={data ?? []}
      filename="learner-progress"
      isLoading={isLoading}
    />
  );
}

const ATTENDANCE_COLUMNS: ReportColumn[] = [
  { key: "class", label: "Class" },
  { key: "course", label: "Course" },
  { key: "date", label: "Date" },
  { key: "attendee", label: "Attendee" },
  { key: "email", label: "Email" },
  { key: "clickedJoinAt", label: "Clicked Join At" },
];

function AttendanceTab() {
  const fn = useServerFn(getAttendanceReport);
  const { data, isLoading } = useQuery({ queryKey: ["report-attendance"], queryFn: () => fn() });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        "Clicked Join At" records when someone clicked Join in the app — live classes run on an
        external provider (Zoom/Meet/Teams) this platform doesn't control, so this is not verified
        in-call presence.
      </p>
      <ReportCard
        title="Live Class Attendance"
        columns={ATTENDANCE_COLUMNS}
        rows={data ?? []}
        filename="attendance"
        isLoading={isLoading}
      />
    </div>
  );
}

const ORG_COLUMNS: ReportColumn[] = [
  { key: "organization", label: "Organization" },
  { key: "type", label: "Type" },
  { key: "members", label: "Members" },
  { key: "certificatesIssued", label: "Certificates Issued" },
];
const TRAINER_COLUMNS: ReportColumn[] = [
  { key: "trainer", label: "Trainer" },
  { key: "ratingCount", label: "Rating Count" },
  { key: "avgRating", label: "Avg Rating" },
];

function OrgStatsTab() {
  const fn = useServerFn(getOrgStatsReport);
  const { data, isLoading } = useQuery({ queryKey: ["report-org"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Organizations</h3>
        <ReportCard
          title="Organization Stats"
          columns={ORG_COLUMNS}
          rows={data?.orgs ?? []}
          filename="org-stats"
          isLoading={isLoading}
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Trainer Ratings</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Average of learner course ratings across each trainer's authored courses.
        </p>
        <ReportCard
          title="Trainer Ratings"
          columns={TRAINER_COLUMNS}
          rows={data?.trainers ?? []}
          filename="trainer-ratings"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

const COMPLIANCE_COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "actor", label: "Actor" },
  { key: "action", label: "Action" },
  { key: "target", label: "Target" },
  { key: "metadata", label: "Metadata" },
];

function ComplianceTab() {
  const [days, setDays] = useState(90);
  const fn = useServerFn(getComplianceLogReport);
  const { data, isLoading } = useQuery({
    queryKey: ["report-compliance", days],
    queryFn: () => fn({ data: { days } }),
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Window:</span>
        {[30, 90, 180, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-full px-2.5 py-1 ${days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            {d}d
          </button>
        ))}
      </div>
      <ReportCard
        title="Compliance / Audit Log"
        columns={COMPLIANCE_COLUMNS}
        rows={data ?? []}
        filename="compliance-audit-log"
        isLoading={isLoading}
      />
    </div>
  );
}
