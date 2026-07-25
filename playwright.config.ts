import { defineConfig, devices } from "@playwright/test";

// These specs run against a real deployed environment (there's no local dev
// server that has the real Supabase/Hostinger backend wired up) — default to
// production, override with E2E_BASE_URL for a staging deploy if one exists.
// Kept deliberately read-only/non-destructive (see e2e/smoke.spec.ts) so
// it's safe to run unattended in CI against the live site.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://travancoreayurvedalearning.com",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
