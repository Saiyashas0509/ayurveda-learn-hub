// Full-screen loading state shown by the router while an authenticated
// route's beforeLoad/data is still resolving (see router.tsx's
// defaultPendingComponent and _authenticated/route.tsx's pendingComponent —
// TanStack Router uses this same component for both the beforeLoad/loader
// pending phase and any React Suspense a route's own useSuspenseQuery calls
// trigger, since each matched route renders inside the router's own
// Suspense boundary).
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden bg-hero">
      {/* Ambient stars */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="loader-star absolute rounded-full bg-[oklch(0.96_0.01_95)]"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
            }}
          />
        ))}
      </div>

      {/* Soft glow behind the scene */}
      <div
        className="loader-glow pointer-events-none absolute h-56 w-56 rounded-full blur-3xl"
        style={{ background: "var(--gold)", opacity: 0.5 }}
        aria-hidden="true"
      />

      <div className="relative" style={{ width: 160, height: 176, perspective: "600px" }}>
        <svg
          viewBox="0 0 160 176"
          width="160"
          height="176"
          role="img"
          aria-hidden="true"
          className="absolute inset-0 overflow-visible drop-shadow-[0_14px_30px_oklch(0_0_0/0.35)]"
        >
          {/* Drifting leaves, rising past the scene */}
          <g
            className="loader-leaf"
            style={{ ["--drift-x" as string]: "18px", animationDelay: "0.2s" }}
            transform="translate(46, 96)"
          >
            <path d="M0 6 C -6 0, -6 -8, 0 -12 C 6 -8, 6 0, 0 6 Z" fill="var(--gold)" />
          </g>
          <g
            className="loader-leaf"
            style={{ ["--drift-x" as string]: "-16px", animationDelay: "1.1s" }}
            transform="translate(104, 100)"
          >
            <path d="M0 5 C -5 0, -5 -7, 0 -10 C 5 -7, 5 0, 0 5 Z" fill="oklch(0.96 0.01 95)" />
          </g>
          <g
            className="loader-leaf"
            style={{ ["--drift-x" as string]: "10px", animationDelay: "2s" }}
            transform="translate(80, 108)"
          >
            <path d="M0 5 C -5 0, -5 -7, 0 -10 C 5 -7, 5 0, 0 5 Z" fill="var(--gold)" />
          </g>

          {/* Rocket, arcing up along a curved flight path from the open book */}
          <g className="loader-rocket" transform="translate(78, 118)">
            <g transform="translate(-11, -46) rotate(90)">
              <path
                className="loader-flame"
                d="M11 46 C 6 55, 6 62, 11 69 C 16 62, 16 55, 11 46 Z"
                fill="var(--gold)"
              />
              <path
                d="M11 0 C 22 10, 25 28, 21 46 L 1 46 C -3 28, 0 10, 11 0 Z"
                fill="oklch(0.98 0.01 95)"
              />
              <path
                d="M11 0 C 22 10, 25 28, 21 46 L 11 46 Z"
                fill="oklch(0.90 0.02 90)"
                opacity="0.6"
              />
              <path d="M1 46 C -6 44, -9 36, -9 30 L 3 38 Z" fill="var(--gold)" />
              <path d="M21 46 C 28 44, 31 36, 31 30 L 19 38 Z" fill="var(--gold)" />
              <circle cx="11" cy="19" r="6.5" fill="var(--primary)" />
              <circle cx="11" cy="19" r="3.4" fill="oklch(0.92 0.03 90)" />
              <circle cx="9" cy="17" r="1.2" fill="oklch(0.98 0.01 95)" opacity="0.8" />
            </g>
          </g>

          {/* Sparks at the launch point */}
          <circle
            className="loader-spark"
            cx="90"
            cy="112"
            r="2.6"
            fill="var(--gold)"
            style={{ animationDelay: "0s" }}
          />
          <circle
            className="loader-spark"
            cx="72"
            cy="110"
            r="2"
            fill="oklch(0.96 0.01 95)"
            style={{ animationDelay: "0.35s" }}
          />
          <circle
            className="loader-spark"
            cx="82"
            cy="116"
            r="1.6"
            fill="var(--gold)"
            style={{ animationDelay: "0.7s" }}
          />

          {/* Book stack, top one open with a turning page */}
          <g className="loader-books">
            <rect x="24" y="140" width="112" height="16" rx="3" fill="var(--gold)" />
            <rect x="24" y="140" width="112" height="4" fill="oklch(0.30 0.05 155 / 0.15)" />
            <rect x="33" y="126" width="94" height="16" rx="3" fill="oklch(0.96 0.01 95)" />
            <rect x="33" y="126" width="94" height="4" fill="oklch(0.30 0.05 155 / 0.15)" />

            {/* Open top book */}
            <path d="M80 108 L38 122 L80 128 L122 122 Z" fill="var(--gold)" opacity="0.9" />
            <path d="M80 108 L38 122 L80 116 Z" fill="oklch(0.30 0.05 155 / 0.12)" />
          </g>
          <g transform="translate(80, 122)" style={{ transformStyle: "preserve-3d" }}>
            <path
              className="loader-page"
              d="M0 -14 L-40 -3 L0 3 Z"
              fill="oklch(0.98 0.01 95)"
              style={{ transformOrigin: "0px 0px" }}
            />
          </g>
        </svg>
      </div>

      <div className="loader-text flex flex-col items-center gap-3">
        <p className="font-display text-lg font-semibold text-primary-foreground">
          Travancore Ayurveda
        </p>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm text-primary-foreground/75">{label}</span>
          <span
            className="relative h-[3px] w-24 overflow-hidden rounded-full bg-primary-foreground/15"
            aria-hidden="true"
          >
            <span
              className="loader-bar-sweep absolute inset-y-0 left-0 w-1/3 rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

const STARS = [
  { left: "18%", top: "22%", size: 3, delay: "0s" },
  { left: "82%", top: "18%", size: 2, delay: "0.6s" },
  { left: "72%", top: "68%", size: 2, delay: "1.2s" },
  { left: "24%", top: "72%", size: 3, delay: "0.3s" },
  { left: "88%", top: "42%", size: 2, delay: "1.6s" },
  { left: "10%", top: "48%", size: 2, delay: "0.9s" },
];
