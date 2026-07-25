import { describe, it, expect } from "vitest";
import { isLateSubmission, canSubmit } from "./assignment-rules";

describe("isLateSubmission", () => {
  it("is never late when there's no due date", () => {
    expect(isLateSubmission(null)).toBe(false);
  });

  it("is late when now is after the due date", () => {
    const dueAt = "2026-01-01T00:00:00.000Z";
    const after = Date.parse("2026-01-02T00:00:00.000Z");
    expect(isLateSubmission(dueAt, after)).toBe(true);
  });

  it("is not late when now is before the due date", () => {
    const dueAt = "2026-01-05T00:00:00.000Z";
    const before = Date.parse("2026-01-01T00:00:00.000Z");
    expect(isLateSubmission(dueAt, before)).toBe(false);
  });
});

describe("canSubmit", () => {
  const dueAt = "2026-01-01T00:00:00.000Z";
  const afterDue = Date.parse("2026-01-02T00:00:00.000Z");
  const beforeDue = Date.parse("2025-12-31T00:00:00.000Z");

  it("blocks a late submission when late submissions aren't allowed", () => {
    expect(canSubmit(dueAt, false, afterDue)).toBe(false);
  });

  it("allows a late submission when the assignment explicitly allows it", () => {
    expect(canSubmit(dueAt, true, afterDue)).toBe(true);
  });

  it("always allows an on-time submission regardless of allowLate", () => {
    expect(canSubmit(dueAt, false, beforeDue)).toBe(true);
    expect(canSubmit(dueAt, true, beforeDue)).toBe(true);
  });

  it("always allows submission when there's no due date at all", () => {
    expect(canSubmit(null, false)).toBe(true);
  });
});
