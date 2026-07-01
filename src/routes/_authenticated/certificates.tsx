import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listMyCertificates } from "@/lib/learning.functions";
import { Award, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/certificates")({
  component: Certs,
});

function Certs() {
  const fn = useServerFn(listMyCertificates);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["my-certs"], queryFn: () => fn() }),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Achievements</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">My Certificates</h1>
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Award className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Complete a course to earn your first certificate.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => {
            const title = (c as { courses?: { title?: string } }).courses?.title ?? "Course";
            return (
            <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="bg-hero p-5 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-gold">Certificate of Completion</p>
                  <Award className="h-5 w-5 text-gold" />
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
              </div>
              <div className="p-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certificate code</span>
                  <span className="font-mono font-medium">{c.cert_code}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">Issued</span>
                  <span>{new Date(c.issued_at).toLocaleDateString()}</span>
                </div>
                {c.score_percent != null && (
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-medium">{c.score_percent}%</span>
                  </div>
                )}
                <Link
                  to="/verify/$code"
                  params={{ code: c.cert_code }}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Public verification page <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
