// Pure certificate-expiry math, split out of learning.functions.ts so it's
// unit-testable without mocking Supabase.
export function computeCertificateExpiry(
  renewalPeriodMonths: number | null | undefined,
  issuedAtMs: number = Date.now(),
): string | null {
  if (!renewalPeriodMonths) return null;
  return new Date(issuedAtMs + renewalPeriodMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
}
