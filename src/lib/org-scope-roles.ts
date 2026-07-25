// Roles allowed org-scoped access to cross-employee data (admin overview,
// exportable reports, etc). Deliberately excludes doctor/faculty/trainer —
// those are self-signup roles (see SELF_SIGNUP_ROLES in auth-helpers.ts),
// and including them here would let a self-registered account read another
// organization's employee/audit data. This was a real vulnerability found
// and fixed once already this session; kept as one shared constant (instead
// of separately duplicated in admin.functions.ts and reports.functions.ts)
// specifically so it can't drift out of sync or be redefined too broadly in
// a future edit. See org-scope-roles.test.ts for the regression guard.
export const ORG_SCOPED_REPORTING_ROLES = new Set([
  "org_admin",
  "franchise_owner",
  "regional_manager",
  "center_head_doctor",
]);

// Auditor is included here (unlike the narrower ORG_SCOPED set above) since
// audit/compliance visibility is exactly what that role exists for.
export const PLATFORM_WIDE_REPORTING_ROLES = new Set(["super_admin", "hr_admin", "auditor"]);
