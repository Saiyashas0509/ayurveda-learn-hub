// Client-side cookie/local-storage consent preference. Works for anonymous
// visitors on the public landing page too, so it's local-storage-only rather
// than tied to a user account. See recordCookieConsent in auth.functions.ts
// for the best-effort server-side record made when the visitor happens to
// already be signed in.
export type ConsentChoice = "all" | "essential";

const CONSENT_KEY = "cookie-consent";

export function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === "all" || v === "essential" ? v : null;
}

export function setStoredConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, choice);
}

// Non-essential local storage (e.g. "have you seen the tour") should only be
// written if the visitor opted into "all" — declining means we don't
// remember functional preferences across visits, same as declining
// functional cookies anywhere else.
export function hasFunctionalConsent(): boolean {
  return getStoredConsent() === "all";
}
