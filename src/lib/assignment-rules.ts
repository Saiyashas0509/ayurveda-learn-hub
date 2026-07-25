// Pure assignment-submission rules, split out of assignments.functions.ts so
// they're unit-testable without mocking Supabase.
export function isLateSubmission(dueAt: string | null, nowMs: number = Date.now()): boolean {
  if (!dueAt) return false;
  return nowMs > new Date(dueAt).getTime();
}

export function canSubmit(
  dueAt: string | null,
  allowLate: boolean,
  nowMs: number = Date.now(),
): boolean {
  return !(isLateSubmission(dueAt, nowMs) && !allowLate);
}
