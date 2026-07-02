import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { verifyCertificate } from "@/lib/learning.functions";
import { ShieldCheck, XCircle, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/verify/$code")({
  component: VerifyPage,
});

function VerifyPage() {
  const { code } = Route.useParams();
  const verify = useServerFn(verifyCertificate);
  const { data, isLoading } = useQuery({
    queryKey: ["verify", code],
    queryFn: () => verify({ data: { code } }),
  });
  // Supabase returns single relations as arrays in generated types; cast.
  const cert = data?.cert as
    | {
        cert_code: string;
        issued_at: string;
        courses: { title: string } | null;
        employees: { full_name: string; centers: { name: string } | null } | null;
      }
    | null
    | undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="bg-hero p-6 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <BrandLogo onDark className="h-60" />
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Certificate Verification</p>
          </div>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : cert ? (
            <div>
              <div className="flex items-center gap-2 text-success">
                <ShieldCheck className="h-5 w-5" />
                <p className="font-medium">Valid certificate</p>
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                <Field label="Certificate code" value={cert.cert_code} />
                <Field label="Course" value={cert.courses?.title ?? "—"} />
                <Field label="Awarded to" value={cert.employees?.full_name ?? "—"} />
                <Field label="Center" value={cert.employees?.centers?.name ?? "—"} />
                <Field label="Issued" value={new Date(cert.issued_at).toLocaleDateString()} />
              </dl>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <p className="font-medium">Certificate not found</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                No certificate matches the code <code className="rounded bg-muted px-1.5 py-0.5">{code}</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
