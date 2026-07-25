import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { QrCode, XCircle } from "lucide-react";

export const Route = createFileRoute("/scan")({
  component: ScanPage,
});

// Public certificate QR scanner — no app install needed, works via the
// phone's browser camera. Any QR that decodes to a /verify/:code URL on
// this site (what the certificate PDF's QR encodes) routes straight to the
// existing public verification page; anything else is rejected rather than
// followed, so this can't be used to open an arbitrary attacker URL.
function ScanPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !containerRef.current) return;
        scanner = new Html5Qrcode(containerRef.current.id);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            let path: string | null = null;
            try {
              const url = new URL(decodedText, window.location.origin);
              if (url.origin === window.location.origin && url.pathname.startsWith("/verify/")) {
                path = url.pathname;
              }
            } catch {
              // Not a URL — ignore, keep scanning.
            }
            if (path) {
              scanner?.stop().catch(() => null);
              navigate({ to: path });
            }
          },
          () => {
            // Per-frame "no QR found" callback — expected on almost every
            // frame, intentionally not surfaced as an error.
          },
        );
        setStarting(false);
      } catch (e) {
        setStarting(false);
        setError(
          e instanceof Error && e.message.toLowerCase().includes("permission")
            ? "Camera permission was denied. Allow camera access and reload this page."
            : "Couldn't start the camera. Make sure this page is opened over HTTPS on a device with a camera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      scanner?.stop().catch(() => null);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="bg-hero p-6 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <BrandLogo onDark className="h-16" />
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">
              Scan Certificate
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <QrCode className="h-4 w-4" />
            Point your camera at the QR code on a certificate
          </div>
          <div
            id="qr-reader"
            ref={containerRef}
            className="mt-4 overflow-hidden rounded-lg border border-border"
          />
          {starting && !error && (
            <p className="mt-3 text-center text-xs text-muted-foreground">Starting camera…</p>
          )}
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
