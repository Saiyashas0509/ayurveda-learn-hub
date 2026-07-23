import { cn } from "@/lib/utils";

export type PillTone = "success" | "warning" | "danger" | "neutral" | "info";

const TONE_CLASSES: Record<PillTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
};

const DOT_CLASSES: Record<PillTone, string> = {
  success: "bg-success",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/50",
  info: "bg-primary",
};

export function StatusPill({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}
