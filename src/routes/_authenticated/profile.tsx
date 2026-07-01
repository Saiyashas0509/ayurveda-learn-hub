import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, type AppRole } from "@/lib/auth-helpers";
import { User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const [me, setMe] = useState<{
    email?: string;
    full_name?: string;
    designation?: string;
    employee_code?: string;
    center?: string;
    roles: AppRole[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: emp } = await supabase
        .from("employees")
        .select("email,full_name,designation,employee_code,centers(name)")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setMe({
        email: emp?.email,
        full_name: emp?.full_name,
        designation: emp?.designation ?? undefined,
        employee_code: emp?.employee_code ?? undefined,
        center: (emp as { centers?: { name?: string } } | null)?.centers?.name,
        roles: (roles ?? []).map((r) => r.role as AppRole),
      });
    })();
  }, []);

  if (!me) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Account</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">My Profile</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-2xl font-semibold text-gold-foreground">
            {(me.full_name ?? "TA").split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">{me.full_name}</h2>
            <p className="text-sm text-muted-foreground">{me.email}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Designation" value={me.designation ?? "—"} />
          <Field label="Employee code" value={me.employee_code ?? "—"} />
          <Field label="Center" value={me.center ?? "—"} />
          <Field label="Role(s)" value={me.roles.map((r) => ROLE_LABELS[r]).join(", ") || "—"} />
        </dl>
      </div>

      <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        <User className="inline h-4 w-4" /> Profile changes are managed by HR. Contact your administrator to update these details.
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
