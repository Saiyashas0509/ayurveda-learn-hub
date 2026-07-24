import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getOnboardingContext, completeOnboarding } from "@/lib/onboarding.functions";
import {
  LEARNING_INTERESTS,
  ROLE_LABELS,
  ORG_TYPE_LABELS,
  type AppRole,
  type OrgType,
} from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function ctxQuery(fn: () => Promise<Awaited<ReturnType<typeof getOnboardingContext>>>) {
  return queryOptions({ queryKey: ["onboarding-ctx"], queryFn: fn });
}

function OnboardingPage() {
  const navigate = useNavigate();
  const getCtx = useServerFn(getOnboardingContext);
  const submit = useServerFn(completeOnboarding);
  const { data: ctx } = useSuspenseQuery(ctxQuery(() => getCtx()));

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<AppRole>((ctx.allowedRoles[0] ?? "student") as AppRole);
  const [organizationId, setOrganizationId] = useState<string>(ctx.pending?.organization_id ?? "");
  const [centerId, setCenterId] = useState<string>(ctx.pending?.center_id ?? "");
  const [fullName, setFullName] = useState<string>(
    ctx.pending?.full_name ?? ctx.employee?.full_name ?? "",
  );
  const [phone, setPhone] = useState<string>(ctx.pending?.phone ?? "");
  const [designation, setDesignation] = useState<string>(ctx.pending?.designation ?? "");
  const [interests, setInterests] = useState<string[]>(
    (ctx.pending?.learning_interests as string[]) ?? [],
  );
  const [termsAccepted, setTermsAccepted] = useState(false);

  const centers = useMemo(
    () => ctx.centers.filter((c) => !organizationId || c.organization_id === organizationId),
    [ctx.centers, organizationId],
  );

  const roleLocked = ctx.allowedRoles.length === 1;
  const orgLocked = !!ctx.pending?.organization_id;

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          fullName,
          phone: phone || undefined,
          designation: designation || undefined,
          role,
          organizationId,
          centerId: centerId || null,
          learningInterests: interests,
          termsAccepted,
        },
      }),
    onSuccess: () => {
      toast.success("Welcome aboard!");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not complete onboarding"),
  });

  if (ctx.completed) {
    navigate({ to: "/dashboard" });
    return null;
  }

  const steps = [
    { title: "Your role & organization", icon: Building2 },
    { title: "Profile basics", icon: GraduationCap },
    { title: "Learning interests", icon: Sparkles },
  ];

  const canNext =
    (step === 0 && !!role && !!organizationId) ||
    (step === 1 && fullName.trim().length >= 2) ||
    step === 2;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Welcome</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Set up your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A few quick details so we can point you to the right training.
        </p>
      </div>

      <ol className="mb-8 grid grid-cols-3 gap-3">
        {steps.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li
              key={s.title}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm",
                active
                  ? "border-primary bg-primary/5 text-foreground"
                  : done
                    ? "border-success/40 bg-success/5 text-foreground"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <s.icon className="h-4 w-4" />
              )}
              <span className="truncate">{s.title}</span>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as AppRole)}
                disabled={roleLocked}
              >
                <SelectTrigger id="role" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ctx.allowedRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleLocked ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Your role was assigned by your administrator.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Other roles (doctor, franchise owner, etc.) require an admin invitation for tenant
                  isolation.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="org">Organization</Label>
              <Select value={organizationId} onValueChange={setOrganizationId} disabled={orgLocked}>
                <SelectTrigger id="org" className="mt-1">
                  <SelectValue placeholder="Choose your organization" />
                </SelectTrigger>
                <SelectContent>
                  {ctx.organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}{" "}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ORG_TYPE_LABELS[o.org_type as OrgType]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="center">Center (optional)</Label>
              <Select
                value={centerId || "__none__"}
                onValueChange={(v) => setCenterId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="center" className="mt-1">
                  <SelectValue placeholder="Select a center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific center</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.city ? ` · ${c.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1"
                placeholder="Your full name"
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                  placeholder="+91 …"
                  maxLength={40}
                />
              </div>
              <div>
                <Label htmlFor="designation">Designation (optional)</Label>
                <Input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. Junior Therapist"
                  maxLength={120}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>What are you interested in learning?</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick at least one. We'll use these to recommend courses.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {LEARNING_INTERESTS.map((i) => {
                const on = interests.includes(i);
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() =>
                      setInterests((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i]))
                    }
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    {i}
                  </button>
                );
              })}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-snug text-foreground">
                I have read and agree to the{" "}
                <Link to="/terms" target="_blank" className="text-primary hover:underline">
                  Terms &amp; Conditions
                </Link>{" "}
                and{" "}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                , including the collection of login, device, and activity data described there.
              </Label>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => mutation.mutate()}
              disabled={
                mutation.isPending ||
                interests.length === 0 ||
                !organizationId ||
                fullName.trim().length < 2 ||
                !termsAccepted
              }
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Finish setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
