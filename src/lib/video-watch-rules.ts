// Pure video-completion rules, split out of learning.functions.ts so they're
// unit-testable without mocking Supabase.
//
// A lesson's video counts as "fully watched" once the furthest position
// reached is within 2% of its duration — not exactly 100%, since video
// `duration`/`timeupdate` events are rarely frame-perfect and a strict >=
// would leave completion permanently unreachable for a lot of real videos.
// Lessons with no known duration (legacy uploads from before duration was
// computed automatically at upload time) aren't gated at all.
const WATCHED_THRESHOLD = 0.98;

export function isVideoWatchRequirementMet(
  durationSeconds: number | null,
  watchedSeconds: number,
  skipDetected: boolean,
): boolean {
  if (!durationSeconds || durationSeconds <= 0) return true;
  if (skipDetected) return false;
  return watchedSeconds >= durationSeconds * WATCHED_THRESHOLD;
}
