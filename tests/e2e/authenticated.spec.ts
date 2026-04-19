/**
 * Authenticated smoke tests.
 *
 * These tests require real Supabase credentials set in the environment:
 *   TEST_USER_EMAIL   — a valid test account email
 *   TEST_USER_PASSWORD — its password
 *
 * If the env vars are not set, all tests in this file are skipped.
 */
import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.TEST_USER_EMAIL ?? "";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
}

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️  TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping authenticated tests");
  }
});

test.describe("Authenticated — smoke tests", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_USER_EMAIL / TEST_USER_PASSWORD not set");

  test("dashboard loads with main sections", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Dashboard")).toBeVisible();
    // Sidebar nav should be visible
    await expect(page.getByRole("link", { name: /transactions/i })).toBeVisible();
  });

  test("transactions page loads", async ({ page }) => {
    await login(page);
    await page.goto("/transactions");
    await expect(page).toHaveURL(/transactions/);
    await expect(page.getByText("Transactions")).toBeVisible({ timeout: 10000 });
  });

  test("accounts page loads", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await expect(page.getByText("Accounts")).toBeVisible({ timeout: 10000 });
  });

  test("budgets page loads", async ({ page }) => {
    await login(page);
    await page.goto("/budgets");
    await expect(page.getByText("Budgets")).toBeVisible({ timeout: 10000 });
  });

  test("categories page loads", async ({ page }) => {
    await login(page);
    await page.goto("/categories");
    await expect(page.getByText("Categories")).toBeVisible({ timeout: 10000 });
  });

  test("analytics page loads", async ({ page }) => {
    await login(page);
    await page.goto("/analytics");
    await expect(page.getByText("Analytics")).toBeVisible({ timeout: 10000 });
  });

  test("settings page loads with all cards", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await expect(page.getByText("Profile")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Security")).toBeVisible();
    await expect(page.getByText("Danger Zone")).toBeVisible();
  });

  test("sign out works", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });
});
