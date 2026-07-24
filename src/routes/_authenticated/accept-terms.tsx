import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordTermsAcceptance } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Reached only by accounts that skip the self-signup onboarding wizard
// (admin-created employees, and admins themselves) — self-signup users
// accept Terms & Privacy as part of that wizard instead. Excluded from the
// _authenticated route guard's own redirect so it doesn't loop.
export const Route = createFileRoute("/_authenticated/accept-terms")({
  component: AcceptTermsPage,
});

function AcceptTermsPage() {
  const navigate = useNavigate();
  const record = useServerFn(recordTermsAcceptance);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      await record({});
      toast.success("Thanks — you're all set.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-16" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="font-display text-xl font-semibold text-foreground">
              Before you continue
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            We need your explicit agreement to our Terms and Privacy Policy before you can use the
            Platform.
          </p>

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox
              id="accept-terms"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="accept-terms"
              className="text-sm font-normal leading-snug text-foreground"
            >
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

          <Button className="mt-6 w-full" disabled={!checked || loading} onClick={accept}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Agree and continue
          </Button>
        </div>
      </div>
    </div>
  );
}
