import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type TourStep = {
  target: string; // CSS selector, e.g. '[data-tour="nav-/catalog"]'
  title: string;
  body: string;
  // If the target lives inside the collapsible mobile sidebar, the tour
  // opens it automatically for this step so the spotlight has something to find.
  opensSidebar?: boolean;
};

type Rect = { top: number; left: number; width: number; height: number };

function getRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// A small first-run product tour: a spotlight cutout over a real UI element
// plus a positioned tooltip with Back/Next/Skip. Steps target persistent
// chrome (sidebar nav, header buttons) so the same tour works no matter
// which page the user lands on after signing in.
export function Tour({
  steps,
  onOpenSidebar,
  onDone,
}: {
  steps: TourStep[];
  onOpenSidebar?: (open: boolean) => void;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[index];

  useEffect(() => {
    onOpenSidebar?.(!!step?.opensSidebar);
  }, [step, onOpenSidebar]);

  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => setRect(getRect(step.target));
    // Wait a tick for the sidebar-open transition/DOM update before measuring.
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  if (!step) return null;

  const finish = () => {
    onOpenSidebar?.(false);
    onDone();
  };

  const next = () => (index < steps.length - 1 ? setIndex(index + 1) : finish());
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Tooltip placement: to the right of the target if there's room, else below,
  // else just centered on screen (also the fallback when target isn't found).
  const tooltipStyle: React.CSSProperties = rect
    ? rect.left + rect.width + 340 < window.innerWidth
      ? { top: Math.max(16, rect.top), left: rect.left + rect.width + 16 }
      : {
          top: Math.min(rect.top + rect.height + 12, window.innerHeight - 220),
          left: Math.max(16, rect.left),
        }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dimmed backdrop with a spotlight cutout via box-shadow */}
      {rect ? (
        <div
          className="absolute rounded-md transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            outline: "2px solid var(--gold, #c9a227)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      <div
        className="absolute w-80 rounded-xl border border-border bg-card p-4 shadow-elevated"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Step {index + 1} of {steps.length}
          </p>
          <button
            onClick={finish}
            aria-label="Skip tour"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-2 font-display text-base font-semibold">{step.title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-xs text-muted-foreground hover:underline">
            Skip tour
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={back}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {index < steps.length - 1 ? "Next" : "Done"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
