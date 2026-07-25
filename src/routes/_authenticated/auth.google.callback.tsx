import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { completeGoogleConnect } from "@/lib/google-meet.functions";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auth/google/callback")({
  component: GoogleCallback,
});

// Google redirects here with ?code=...&state=... after the trainer approves
// calendar access. Exchanges the code for tokens (server-side, using the
// client secret) and stores them, then bounces back to Live Classes.
function GoogleCallback() {
  const navigate = useNavigate();
  const complete = useServerFn(completeGoogleConnect);
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    const expectedState = sessionStorage.getItem("google_oauth_state");
    const state = params.get("state");
    sessionStorage.removeItem("google_oauth_state");

    if (error) {
      setStatus("error");
      setMessage("Google sign-in was cancelled or denied.");
      return;
    }
    // Both sides of this check must actually be present and equal — a
    // missing expectedState (e.g. this URL was sent to someone who never
    // started the flow themselves, from a different tab/session, or via a
    // crafted link) must fail closed, not be treated as "nothing to check."
    if (!code || !expectedState || !state || state !== expectedState) {
      setStatus("error");
      setMessage("This link is invalid or expired. Please try connecting again.");
      return;
    }
    complete({ data: { code } })
      .then((r) => {
        setStatus("done");
        setMessage(r.email ? `Connected as ${r.email}` : "Connected");
        setTimeout(() => navigate({ to: "/admin/live" }), 1500);
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Couldn't connect your Google account.");
      });
  }, [complete, navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      {status === "working" && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
      {status === "done" && <CheckCircle2 className="h-8 w-8 text-success" />}
      {status === "error" && <XCircle className="h-8 w-8 text-destructive" />}
      <p className="text-sm text-muted-foreground">
        {status === "working" ? "Connecting your Google account…" : message}
      </p>
    </div>
  );
}
