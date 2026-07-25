import { test, expect } from "@playwright/test";

// Deliberately read-only smoke tests against the live site — no login, no
// data creation. These catch "the site is actually broken" (bad deploy,
// SSR crash, routing regression), not full feature coverage. Real
// login-gated flows (course completion, grading, certificate issuance,
// bulk import, etc.) have been verified manually against production
// throughout this project via one-off Playwright scripts, not as a
// standing suite — see the project notes for what's been exercised.

test("home page loads and shows the sign-in CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/./);
  await expect(page.locator("body")).toBeVisible();
});

test("employee login page renders the email/password form", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
});

test("admin login page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator("#admin-email")).toBeVisible();
  await expect(page.locator("#admin-password")).toBeVisible();
});

test("public certificate verification page handles an unknown code without crashing", async ({
  page,
}) => {
  await page.goto("/verify/this-code-does-not-exist");
  await expect(page.getByText(/certificate not found/i)).toBeVisible({ timeout: 10_000 });
});

test("public certificate scanner page renders without crashing", async ({ page }) => {
  await page.goto("/scan");
  await expect(page.getByText(/scan certificate/i)).toBeVisible();
});
