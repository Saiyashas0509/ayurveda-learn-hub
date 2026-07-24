import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import {
  listEmployees,
  createEmployeeUser,
  setUserStatus,
  bulkSetUserStatus,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatusPill } from "@/components/admin/status-pill";
import {
  TABLE_WRAP,
  TABLE,
  THEAD,
  TH,
  TH_RIGHT,
  TBODY,
  TR,
  TR_SELECTED,
  TD,
  TD_MUTED,
  TD_RIGHT,
  EMPTY_ROW,
} from "@/components/admin/table";
import { toast } from "sonner";
import { UserPlus, Ban, CheckCircle2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/lib/auth-helpers";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

const PAGE_SIZE = 20;

// Supabase's generated types don't declare an employees -> user_roles FK
// (user_roles.user_id references auth.users, not employees), so the joined
// select below comes back typed as an error placeholder. This describes the
// shape the query actually returns at runtime.
type EmployeeRow = {
  id: string;
  email: string;
  full_name: string;
  status: "active" | "disabled" | "pending";
  designation: string | null;
  employee_code: string | null;
  center_id: string | null;
  created_at: string;
  centers: { name: string } | null;
  user_roles: { role: AppRole }[] | null;
};

const ADMIN_ASSIGNABLE_ROLES: AppRole[] = [
  "super_admin",
  "hr_admin",
  "regional_manager",
  "center_head_doctor",
  "front_office",
  "therapist",
  "trainer",
  "auditor",
];

function UsersPage() {
  const fn = useServerFn(listEmployees);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [role, setRole] = useState<AppRole | "all">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = ["admin-employees", { debouncedSearch, status, role, page }];
  const { data, isLoading, isFetching } = useQuery(
    queryOptions({
      queryKey,
      queryFn: () =>
        fn({
          data: { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, status, role },
        }),
      placeholderData: (prev) => prev,
    }),
  );

  const rows = useMemo(() => (data?.rows ?? []) as unknown as EmployeeRow[], [data]);
  const total = data?.total ?? 0;
  const pageCount = data?.pageCount ?? 1;

  const createFn = useServerFn(createEmployeeUser);
  const statusFn = useServerFn(setUserStatus);
  const bulkFn = useServerFn(bulkSetUserStatus);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    role: "front_office" as AppRole,
    centerId: "",
    designation: "",
  });
  const [saving, setSaving] = useState(false);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase
      .from("centers")
      .select("id,name")
      .order("name")
      .then(({ data }) => setCenters(data ?? []));
  }, []);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-employees"] });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createFn({
        data: {
          email: form.email.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          role: form.role,
          centerId: form.centerId || null,
          designation: form.designation || undefined,
        },
      });
      toast.success("Employee created. They can now sign in.");
      setOpen(false);
      setForm({ email: "", fullName: "", role: "front_office", centerId: "", designation: "" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, s: "active" | "disabled") {
    await statusFn({ data: { userId: id, status: s } });
    toast.success(`User ${s}`);
    invalidate();
  }

  async function bulkToggle(s: "active" | "disabled") {
    if (selected.size === 0) return;
    await bulkFn({ data: { userIds: Array.from(selected), status: s } });
    toast.success(`${selected.size} user(s) ${s}`);
    setSelected(new Set());
    invalidate();
  }

  const allOnPageSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Users"
        description={`${total} employee${total === 1 ? "" : "s"} across the organization.`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                New employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create employee account</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    maxLength={255}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Center</Label>
                    <Select
                      value={form.centerId}
                      onValueChange={(v) => setForm({ ...form, centerId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select center" />
                      </SelectTrigger>
                      <SelectContent>
                        {centers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    maxLength={120}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Creating…" : "Create employee"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, code…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v as AppRole | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ADMIN_ASSIGNABLE_ROLES.map((v) => (
              <SelectItem key={v} value={v}>
                {ROLE_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkToggle("active")}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Activate
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggle("disabled")}>
              <Ban className="mr-1 h-3.5 w-3.5" /> Disable
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all on page"
                />
              </th>
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              <th className={TH}>Role</th>
              <th className={TH}>Center</th>
              <th className={TH}>Status</th>
              <th className={TH_RIGHT}>Actions</th>
            </tr>
          </thead>
          <tbody className={TBODY}>
            {rows.map((u) => (
              <tr key={u.id} className={selected.has(u.id) ? TR_SELECTED : TR}>
                <td className={TD}>
                  <Checkbox
                    checked={selected.has(u.id)}
                    onCheckedChange={() => toggleOne(u.id)}
                    aria-label={`Select ${u.full_name}`}
                  />
                </td>
                <td className={`${TD} font-medium`}>
                  <Link
                    to="/admin/users/$userId"
                    params={{ userId: u.id }}
                    className="hover:text-primary hover:underline"
                  >
                    {u.full_name}
                  </Link>
                </td>
                <td className={TD_MUTED}>{u.email}</td>
                <td className={TD}>
                  {u.user_roles?.[0]?.role ? ROLE_LABELS[u.user_roles[0].role as AppRole] : "—"}
                </td>
                <td className={TD}>{u.centers?.name ?? "—"}</td>
                <td className={TD}>
                  <StatusPill tone={u.status === "active" ? "success" : "danger"}>
                    {u.status}
                  </StatusPill>
                </td>
                <td className={TD_RIGHT}>
                  {u.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => toggle(u.id, "disabled")}>
                      <Ban className="mr-1 h-3.5 w-3.5" /> Disable
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => toggle(u.id, "active")}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Activate
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className={EMPTY_ROW}>
                  No employees match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
