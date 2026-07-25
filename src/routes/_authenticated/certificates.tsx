import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listMyCertificates, getCertificateDownloadUrl } from "@/lib/learning.functions";
import { Button } from "@/components/ui/button";
import { Award, Download, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/certificates")({
  component: Certs,
});

function Certs() {
  const fn = useServerFn(listMyCertificates);
  const getDownloadUrl = useServerFn(getCertificateDownloadUrl);
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["my-certs"], queryFn: () => fn() }));
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);

  const download = async (certCode: string) => {
    setDownloadingCode(certCode);
    try {
      const { url } = await getDownloadUrl({ data: { certCode } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate certificate PDF");
    } finally {
      setDownloadingCode(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Achievements</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">My Certificates</h1>
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Award className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Complete a course to earn your first certificate.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => {
            const title = (c as { courses?: { title?: string } }).courses?.title ?? "Course";
            return (
              <div
                key={c.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
              >
                <div className="bg-hero p-5 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest text-gold">
                      Certificate of Completion
                    </p>
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
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Link
                      to="/verify/$code"
                      params={{ code: c.cert_code }}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Verify <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingCode === c.cert_code}
                      onClick={() => download(c.cert_code)}
                    >
                      {downloadingCode === c.cert_code ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Download PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
