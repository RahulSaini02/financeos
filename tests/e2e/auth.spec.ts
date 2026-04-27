import { test, expect } from "@playwright/test";

test.describe("Auth — Login page", () => {
  test("login page loads and shows all elements", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "FinanceOS" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByText("Don't have an account? Sign up")).toBeVisible();
  });

  test("toggles to sign-up mode", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Don't have an account? Sign up").click();

    // Wait for the Full Name field to appear (React state update)
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible({ timeout: 3000 });
    await expect(page.getByPlaceholder("Rahul Saini")).toBeVisible();
    await expect(page.getByText("Already have an account? Sign in")).toBeVisible();
  });

  test("shows error on bad credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill("bad@example.com");
    await page.getByPlaceholder("••••••••").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Error appears as a paragraph with danger color — match by content pattern
    await expect(
      page.locator("p").filter({ hasText: /invalid|incorrect|credentials|password|email/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated /settings redirects to /login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated /transactions redirects to /login", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/login/);
  });
});
