// Full-screen loading state shown by the router while an authenticated
// route's beforeLoad/data is still resolving (see router.tsx's
// defaultPendingComponent and _authenticated/route.tsx's pendingComponent —
// TanStack Router uses this same component for both the beforeLoad/loader
// pending phase and any React Suspense a route's own useSuspenseQuery calls
// trigger, since each matched route renders inside the router's own
// Suspense boundary).
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-hero">
      <svg
        viewBox="0 0 160 140"
        width="128"
        height="112"
        role="img"
        aria-hidden="true"
        className="drop-shadow-[0_12px_28px_oklch(0_0_0/0.35)]"
      >
        {/* Book stack */}
        <g className="loader-books">
          <rect x="28" y="104" width="104" height="16" rx="3" fill="var(--gold)" />
          <rect x="36" y="90" width="88" height="16" rx="3" fill="oklch(0.96 0.01 95)" />
          <rect x="44" y="76" width="72" height="16" rx="3" fill="var(--gold)" opacity="0.85" />
          <rect x="36" y="90" width="88" height="4" fill="oklch(0.30 0.05 155 / 0.15)" />
          <rect x="28" y="104" width="104" height="4" fill="oklch(0.30 0.05 155 / 0.15)" />
        </g>

        {/* Sparks trailing the rocket */}
        <circle
          className="loader-spark"
          cx="96"
          cy="70"
          r="2.5"
          fill="var(--gold)"
          style={{ animationDelay: "0s" }}
        />
        <circle
          className="loader-spark"
          cx="86"
          cy="66"
          r="2"
          fill="oklch(0.96 0.01 95)"
          style={{ animationDelay: "0.35s" }}
        />
        <circle
          className="loader-spark"
          cx="92"
          cy="60"
          r="1.6"
          fill="var(--gold)"
          style={{ animationDelay: "0.7s" }}
        />

        {/* Rocket */}
        <g className="loader-rocket" transform="translate(70, 20)">
          <path
            className="loader-flame"
            d="M11 46 C 7 54, 7 60, 11 66 C 15 60, 15 54, 11 46 Z"
            fill="var(--gold)"
          />
          <path
            d="M11 0 C 22 10, 25 28, 21 46 L 1 46 C -3 28, 0 10, 11 0 Z"
            fill="oklch(0.98 0.01 95)"
          />
          <path d="M1 46 C -6 44, -9 36, -9 30 L 3 38 Z" fill="var(--gold)" />
          <path d="M21 46 C 28 44, 31 36, 31 30 L 19 38 Z" fill="var(--gold)" />
          <circle cx="11" cy="19" r="6.5" fill="var(--primary)" />
          <circle cx="11" cy="19" r="3.4" fill="oklch(0.90 0.02 90)" />
        </g>
      </svg>

      <div className="flex flex-col items-center gap-2">
        <p className="font-display text-lg font-semibold text-primary-foreground">
          Travancore Ayurveda
        </p>
        <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
          <span>{label}</span>
          <span className="flex items-center gap-0.5" aria-hidden="true">
            <span
              className="loader-dot h-1 w-1 rounded-full bg-gold"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="loader-dot h-1 w-1 rounded-full bg-gold"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="loader-dot h-1 w-1 rounded-full bg-gold"
              style={{ animationDelay: "0.3s" }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
