export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

// Lightweight UA -> "Browser on OS" summary. Not exhaustive, just readable —
// good enough for an admin activity log, not a full device-detection library.
export function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "—";
  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/crios\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";
  else if (/opr\//i.test(ua)) browser = "Opera";

  return `${browser} on ${os}`;
}

export function formatLocation(city: string | null, country: string | null): string {
  if (city && country) return `${city}, ${country}`;
  return city ?? country ?? "—";
}

// Human-readable label for an audit_logs.action value, e.g.
// "course_updated" -> "Course updated".
export function formatActionLabel(action: string): string {
  const s = action.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
