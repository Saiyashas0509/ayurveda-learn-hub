import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import { getStoredConsent, setStoredConsent, type ConsentChoice } from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getStoredConsent() === null);
  }, []);

  async function choose(choice: ConsentChoice) {
    setStoredConsent(choice);
    setVisible(false);
    try {
      const { recordCookieConsent } = await import("@/lib/auth.functions");
      await recordCookieConsent({ data: { choice } });
    } catch {
      // Not signed in, or a logging hiccup — the local preference is still saved either way.
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-card/95 p-4 shadow-elevated backdrop-blur sm:p-5">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <p className="text-sm text-muted-foreground">
            We use essential local storage to keep you signed in, plus a few functional items to
            remember your preferences. We don't use advertising or third-party tracking cookies. See
            our{" "}
            <Link to="/cookies" className="text-primary hover:underline">
              Cookie Policy
            </Link>{" "}
            for details.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("essential")}>
            Necessary only
          </Button>
          <Button size="sm" onClick={() => choose("all")}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
