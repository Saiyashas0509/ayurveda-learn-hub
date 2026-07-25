import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Papa from "papaparse";
import { bulkCreateEmployeeUsers } from "@/lib/admin.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Download, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

type CsvRow = {
  fullName: string;
  email: string;
  role: string;
  roleKey: AppRole | null;
  center: string;
  designation: string;
  employeeCode: string;
};

type ImportRowResult = { email: string; ok: boolean; error?: string };

const ROLE_KEY_BY_LABEL = new Map(
  (Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([key, label]) => [
    label.toLowerCase(),
    key,
  ]),
);
const ROLE_KEYS = new Set(Object.keys(ROLE_LABELS));

function resolveRoleKey(raw: string): AppRole | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (ROLE_KEYS.has(v)) return v as AppRole;
  return ROLE_KEY_BY_LABEL.get(v) ?? null;
}

function downloadTemplate() {
  const csv = [
    "Full Name,Email,Role,Center,Designation,Employee Code",
    "Jane Doe,jane.doe@example.com,Front Office,Hyderabad Center,Front Desk Lead,EMP-101",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employee-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportUsersDialog({ onImported }: { onImported?: () => void }) {
  const bulkFn = useServerFn(bulkCreateEmployeeUsers);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setResults(null);
  }

  function handleFile(file: File) {
    setResults(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const parsed: CsvRow[] = res.data.map((r) => {
          const roleRaw = r.role ?? "";
          return {
            fullName: (r["full name"] ?? r.fullname ?? r.name ?? "").trim(),
            email: (r.email ?? "").trim().toLowerCase(),
            role: roleRaw.trim(),
            roleKey: resolveRoleKey(roleRaw),
            center: (r.center ?? "").trim(),
            designation: (r.designation ?? "").trim(),
            employeeCode: (r["employee code"] ?? r.employeecode ?? "").trim(),
          };
        });
        setRows(parsed);
      },
      error: () => toast.error("Could not parse that file — make sure it's a valid CSV."),
    });
  }

  const validCount = rows.filter((r) => r.fullName && r.email && r.roleKey).length;
  const invalidCount = rows.length - validCount;

  async function doImport() {
    const valid = rows.filter((r) => r.fullName && r.email && r.roleKey);
    if (valid.length === 0) return;
    setImporting(true);
    try {
      const res = await bulkFn({
        data: {
          rows: valid.map((r) => ({
            email: r.email,
            fullName: r.fullName,
            role: r.roleKey as string,
            centerName: r.center || undefined,
            designation: r.designation || undefined,
            employeeCode: r.employeeCode || undefined,
          })),
        },
      });
      setResults(res.results);
      if (res.succeeded > 0) onImported?.();
      toast.success(`Imported ${res.succeeded} of ${valid.length} user(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import employees</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: Full Name, Email, Role, Center, Designation, Employee Code.
            Role and Center can be typed as shown in the app (e.g. "Front Office", "Hyderabad
            Center").
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex w-fit items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Download className="h-3.5 w-3.5" /> Download CSV template
        </button>

        {!results && (
          <>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border p-6 text-center hover:bg-accent/40">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">
                {fileName || "Click to choose a CSV file"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>

            {rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {validCount} ready
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" /> {invalidCount} need attention
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Name</th>
                        <th className="px-2 py-1.5 text-left">Email</th>
                        <th className="px-2 py-1.5 text-left">Role</th>
                        <th className="px-2 py-1.5 text-left">Center</th>
                        <th className="px-2 py-1.5 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const ok = r.fullName && r.email && r.roleKey;
                        return (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1.5">{r.fullName || "—"}</td>
                            <td className="px-2 py-1.5">{r.email || "—"}</td>
                            <td className="px-2 py-1.5">{r.role || "—"}</td>
                            <td className="px-2 py-1.5">{r.center || "—"}</td>
                            <td className="px-2 py-1.5">
                              {ok ? (
                                <span className="text-green-600">Ready</span>
                              ) : (
                                <span className="text-destructive">
                                  {!r.email
                                    ? "Missing email"
                                    : !r.fullName
                                      ? "Missing name"
                                      : "Unknown role"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {results && (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {r.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                )}
                <span className="font-medium">{r.email}</span>
                {!r.ok && <span className="text-destructive">— {r.error}</span>}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={validCount === 0 || importing} onClick={doImport}>
                {importing
                  ? "Importing…"
                  : `Import ${validCount} user${validCount === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
