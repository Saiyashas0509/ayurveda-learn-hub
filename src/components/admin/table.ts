// Shared className tokens for dense, enterprise-console-style data tables
// across the admin surface. Keep every admin table visually consistent by
// importing these instead of re-authoring table classes per page.

export const TABLE_WRAP = "overflow-x-auto rounded-lg border border-border bg-card shadow-card";
export const TABLE = "w-full min-w-[640px] text-[13px] tabular-nums";
export const THEAD = "border-b border-border bg-muted/60";
export const TH =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
export const TH_RIGHT =
  "px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
export const TBODY = "divide-y divide-border";
export const TR = "transition-colors hover:bg-muted/40";
export const TR_SELECTED = "bg-primary/5 hover:bg-primary/10";
export const TD = "px-4 py-2.5 align-middle";
export const TD_MUTED = "px-4 py-2.5 align-middle text-muted-foreground";
export const TD_RIGHT = "px-4 py-2.5 text-right align-middle";
export const EMPTY_ROW = "p-10 text-center text-sm text-muted-foreground";
