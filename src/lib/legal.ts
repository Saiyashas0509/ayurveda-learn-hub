// Single source of truth for legal document versions. Bump the relevant date
// whenever Terms, Privacy, or Cookie policy content changes materially —
// stored on every consent record so we can always tell which version of
// which document a given user actually agreed to.
export const LEGAL_VERSIONS = {
  terms: "2026-07-24",
  privacy: "2026-07-24",
  cookies: "2026-07-24",
} as const;

export const LEGAL_EFFECTIVE_DATE = "24 July 2026";
