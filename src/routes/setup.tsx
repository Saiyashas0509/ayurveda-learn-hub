import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { superAdminExists, bootstrapFirstAdmin } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const check = useServerFn(superAdminExists);
  const bootstrap = useServerFn(bootstrapFirstAdmin);
  const [state, setState] = useState<"checking" | "form" | "done">("checking");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    check({}).then((r) => setState(r.exists ? "done" : "form")).catch(() => setState("form"));
  }, [check]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await bootstrap({ data: { email: email.trim().toLowerCase(), fullName: fullName.trim() } });
      toast.success("Super Admin created. Sign in to continue.");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-gold-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">First-time setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the initial Super Admin account. This screen only works once — after that, all users are managed from the admin panel.
        </p>

        {state === "checking" && (
          <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}

        {state === "done" && (
          <div className="mt-6 rounded-md border border-border bg-muted p-4 text-sm">
            <p className="font-medium">Setup already complete.</p>
            <p className="mt-1 text-muted-foreground">
              A Super Admin has been created. Please sign in from the login page.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
          </div>
        )}

        {state === "form" && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} placeholder="Your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Company email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} placeholder="admin@travancoreayurveda.com" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Super Admin"}
            </Button>
            <p className="text-xs text-muted-foreground">
              After creation, sign in from the login page — a one-time code will be emailed to you.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
