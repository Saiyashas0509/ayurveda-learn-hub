import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { listEmployees, createEmployeeUser, setUserStatus } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Ban, CheckCircle2 } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/lib/auth-helpers";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const fn = useServerFn(listEmployees);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["admin-employees"], queryFn: () => fn() }));

  const createFn = useServerFn(createEmployeeUser);
  const statusFn = useServerFn(setUserStatus);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "front_office" as AppRole, centerId: "", designation: "" });
  const [saving, setSaving] = useState(false);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("centers").select("id,name").order("name").then(({ data }) => setCenters(data ?? []));
  }, []);

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
      qc.invalidateQueries({ queryKey: ["admin-employees"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, status: "active" | "disabled") {
    await statusFn({ data: { userId: id, status } });
    toast.success(`User ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-employees"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Administration</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Users</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" />New employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create employee account</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Company email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Center</Label>
                  <Select value={form.centerId} onValueChange={(v) => setForm({ ...form, centerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select center" /></SelectTrigger>
                    <SelectContent>
                      {centers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} maxLength={120} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating…" : "Create employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Center</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((u: any) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">{u.user_roles?.[0]?.role ? ROLE_LABELS[u.user_roles[0].role as AppRole] : "—"}</td>
                <td className="px-4 py-3">{u.centers?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
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
            {data.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No employees yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
