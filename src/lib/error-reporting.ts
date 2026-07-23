// Client-side error reporting hook for the root error boundary.
// Currently just logs; wire up Sentry/another provider here if you want
// production error tracking once you're off Lovable's built-in reporting.
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[error_boundary]", error, { route: window.location.pathname, ...context });
}
