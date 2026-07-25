import { describe, it, expect } from "vitest";
import { ORG_SCOPED_REPORTING_ROLES, PLATFORM_WIDE_REPORTING_ROLES } from "./org-scope-roles";
import { SELF_SIGNUP_ROLES } from "./auth-helpers";

// Regression guard for a real vulnerability found and fixed earlier in this
// project: doctor/faculty/trainer are self-signup roles, and a self-
// registered account must never be able to read another organization's
// employee data, stats, or audit/report feeds just by picking one of those
// roles. If this test ever fails, someone re-widened the org-scoped role set
// to include a self-signup role — that's the exact bug class to catch here,
// not a false positive to silence.
describe("org-scoped reporting roles", () => {
  it("never includes a self-signup role", () => {
    for (const role of SELF_SIGNUP_ROLES) {
      expect(ORG_SCOPED_REPORTING_ROLES.has(role)).toBe(false);
    }
  });

  it("platform-wide roles never include a self-signup role either", () => {
    for (const role of SELF_SIGNUP_ROLES) {
      expect(PLATFORM_WIDE_REPORTING_ROLES.has(role)).toBe(false);
    }
  });

  it("still contains the legitimate org-oversight roles", () => {
    for (const role of ["org_admin", "franchise_owner", "regional_manager", "center_head_doctor"]) {
      expect(ORG_SCOPED_REPORTING_ROLES.has(role)).toBe(true);
    }
  });
});
