import { cn } from "@/lib/utils";

export type StatTone = "default" | "success" | "warning" | "danger";

const ICON_CLASSES: Record<StatTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
};

const VALUE_CLASSES: Record<StatTone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-destructive",
};

export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon?: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  tone?: StatTone;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p
            className={cn("font-display text-2xl font-semibold tabular-nums", VALUE_CLASSES[tone])}
          >
            {value}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground/80">{sub}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              ICON_CLASSES[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
