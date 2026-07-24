import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOrganizations,
  upsertOrganization,
  setOrganizationActive,
  listCenters,
  upsertCenter,
  deleteCenter,
  ORG_TYPES,
  CENTER_TYPES,
} from "@/lib/org.functions";
import { ORG_TYPE_LABELS } from "@/lib/auth-helpers";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, MapPin, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  component: OrganizationsPage,
});

const CENTER_TYPE_LABELS: Record<string, string> = {
  clinic: "Clinic",
  franchise_branch: "Franchise Branch",
  hospital_ward: "Hospital Ward",
  training_campus: "Training Campus",
};

function OrganizationsPage() {
  const qc = useQueryClient();
  const fetchOrgs = useServerFn(listOrganizations);
  const fetchCenters = useServerFn(listCenters);
  const toggleActive = useServerFn(setOrganizationActive);
  const removeCenter = useServerFn(deleteCenter);

  const [orgDialog, setOrgDialog] = useState<{ open: boolean; org?: OrgRow }>({ open: false });
  const [centerDialog, setCenterDialog] = useState<{ open: boolean; center?: CenterRow }>({
    open: false,
  });

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: () => fetchOrgs(),
  });
  const { data: centers, isLoading: centersLoading } = useQuery({
    queryKey: ["admin-centers"],
    queryFn: () => fetchCenters(),
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) => toggleActive({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteCenterMut = useMutation({
    mutationFn: (id: string) => removeCenter({ data: { id } }),
    onSuccess: () => {
      toast.success("Center deleted");
      qc.invalidateQueries({ queryKey: ["admin-centers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Organizations & Centers"
        description="Manage tenant organizations and the physical centers under them — no SQL required."
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Building2 className="h-4 w-4" /> Organizations
          </h2>
          <Button size="sm" onClick={() => setOrgDialog({ open: true })}>
            <Plus className="mr-1 h-4 w-4" /> New organization
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orgs ?? []).map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>
                    {ORG_TYPE_LABELS[org.org_type as keyof typeof ORG_TYPE_LABELS] ?? org.org_type}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {org.contact_email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={org.is_active}
                        onCheckedChange={(v) => toggleMut.mutate({ id: org.id, isActive: v })}
                      />
                      <Badge variant={org.is_active ? "default" : "secondary"} className="text-xs">
                        {org.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOrgDialog({ open: true, org })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!orgsLoading && (orgs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No organizations yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <MapPin className="h-4 w-4" /> Centers
          </h2>
          <Button size="sm" onClick={() => setCenterDialog({ open: true })}>
            <Plus className="mr-1 h-4 w-4" /> New center
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>City / Region</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(centers ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {c.code}
                    </Badge>
                  </TableCell>
                  <TableCell>{CENTER_TYPE_LABELS[c.center_type] ?? c.center_type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[c.city, c.region].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.organizations?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCenterDialog({ open: true, center: c })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete center "${c.name}"? Employees keep their account but lose this center assignment.`,
                            )
                          ) {
                            deleteCenterMut.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!centersLoading && (centers ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No centers yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {orgDialog.open && (
        <OrgDialog org={orgDialog.org} onClose={() => setOrgDialog({ open: false })} />
      )}
      {centerDialog.open && (
        <CenterDialog
          center={centerDialog.center}
          organizations={orgs ?? []}
          onClose={() => setCenterDialog({ open: false })}
        />
      )}
    </div>
  );
}

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
};

type CenterRow = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  region: string | null;
  organization_id: string | null;
  center_type: string;
  created_at: string;
  organizations: { name: string } | null;
};

function OrgDialog({ org, onClose }: { org?: OrgRow; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertOrganization);
  const [name, setName] = useState(org?.name ?? "");
  const [orgType, setOrgType] = useState(org?.org_type ?? "internal");
  const [contactEmail, setContactEmail] = useState(org?.contact_email ?? "");

  const saveMut = useMutation({
    mutationFn: () => save({ data: { id: org?.id, name, orgType, contactEmail } }),
    onSuccess: () => {
      toast.success(org ? "Organization updated" : "Organization created");
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{org ? "Edit organization" : "New organization"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={orgType} onValueChange={setOrgType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ORG_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Contact email (optional)</Label>
            <Input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              type="email"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={!name.trim() || saveMut.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CenterDialog({
  center,
  organizations,
  onClose,
}: {
  center?: CenterRow;
  organizations: OrgRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(upsertCenter);
  const [name, setName] = useState(center?.name ?? "");
  const [code, setCode] = useState(center?.code ?? "");
  const [city, setCity] = useState(center?.city ?? "");
  const [region, setRegion] = useState(center?.region ?? "");
  const [centerType, setCenterType] = useState(center?.center_type ?? "clinic");
  const [organizationId, setOrganizationId] = useState(
    center?.organization_id ?? organizations[0]?.id ?? "",
  );

  const saveMut = useMutation({
    mutationFn: () =>
      save({ data: { id: center?.id, name, code, city, region, centerType, organizationId } }),
    onSuccess: () => {
      toast.success(center ? "Center updated" : "Center created");
      qc.invalidateQueries({ queryKey: ["admin-centers"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{center ? "Edit center" : "New center"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Trivandrum Head Office"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TA-TVM" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={centerType} onValueChange={setCenterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CENTER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CENTER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organization</Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || !code.trim() || !organizationId || saveMut.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
