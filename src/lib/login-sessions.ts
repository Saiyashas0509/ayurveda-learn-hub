// Shared login/logout session-pairing logic, used by both the platform-wide
// Login Activity view and a single user's activity profile.
export type JsonMetadata =
  string | number | boolean | null | JsonMetadata[] | { [key: string]: JsonMetadata };

export type LoginEvent = {
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  created_at: string;
  ip: string | null;
  metadata: Record<string, JsonMetadata> | null;
};

export type LoginSession = {
  email: string;
  fullName: string | null;
  role: string | null;
  loginAt: string;
  logoutAt: string | null;
  ip: string | null;
  userAgent: string | null;
  method: string | null;
  city: string | null;
  country: string | null;
};

// events must be pre-sorted ascending by created_at, and pre-filtered to
// action IN ('login_success', 'logout'). Events for different users can be
// mixed in — they're grouped internally by actor_email/actor_id.
export function pairLoginSessions(
  events: LoginEvent[],
  lookup: { nameByEmail: Map<string, string | null>; roleByUserId: Map<string, string> },
): LoginSession[] {
  const byUser = new Map<string, LoginEvent[]>();
  for (const row of events) {
    const key = row.actor_email ?? row.actor_id ?? "unknown";
    const list = byUser.get(key) ?? [];
    list.push(row);
    byUser.set(key, list);
  }

  const toSession = (email: string, open: LoginEvent, logoutAt: string | null): LoginSession => ({
    email,
    fullName: lookup.nameByEmail.get(email) ?? null,
    role: open.actor_id ? (lookup.roleByUserId.get(open.actor_id) ?? null) : null,
    loginAt: open.created_at,
    logoutAt,
    ip: open.ip,
    userAgent: (open.metadata?.user_agent as string | undefined) ?? null,
    method: (open.metadata?.method as string | undefined) ?? null,
    city: (open.metadata?.city as string | undefined) ?? null,
    country: (open.metadata?.country as string | undefined) ?? null,
  });

  const sessions: LoginSession[] = [];
  for (const [email, userEvents] of byUser) {
    let openLogin: LoginEvent | null = null;
    for (const ev of userEvents) {
      if (ev.action === "login_success") {
        if (openLogin) sessions.push(toSession(email, openLogin, null));
        openLogin = ev;
      } else if (ev.action === "logout" && openLogin) {
        sessions.push(toSession(email, openLogin, ev.created_at));
        openLogin = null;
      }
    }
    if (openLogin) sessions.push(toSession(email, openLogin, null));
  }

  sessions.sort((a, b) => b.loginAt.localeCompare(a.loginAt));
  return sessions;
}
