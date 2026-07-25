import { describe, it, expect } from "vitest";
import { computeCertificateExpiry } from "./cert-expiry";

describe("computeCertificateExpiry", () => {
  it("returns null when the course has no renewal period (never expires)", () => {
    expect(computeCertificateExpiry(null)).toBeNull();
    expect(computeCertificateExpiry(undefined)).toBeNull();
    expect(computeCertificateExpiry(0)).toBeNull();
  });

  it("adds N * 30 days to the issue time for a set renewal period", () => {
    const issuedAt = Date.UTC(2026, 0, 1); // 2026-01-01
    const expires = computeCertificateExpiry(12, issuedAt);
    expect(expires).toBe(new Date(issuedAt + 12 * 30 * 24 * 60 * 60 * 1000).toISOString());
  });

  it("a 1-month renewal expires roughly 30 days later, not exactly a calendar month", () => {
    const issuedAt = Date.UTC(2026, 0, 1);
    const expires = new Date(computeCertificateExpiry(1, issuedAt)!);
    const daysLater = (expires.getTime() - issuedAt) / (24 * 60 * 60 * 1000);
    expect(daysLater).toBe(30);
  });
});
