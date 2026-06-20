import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Unauthenticated tests — no saved session
    {
      name: "unauthenticated",
      testMatch: "**/auth.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    // Login once and persist the session to playwright/.auth/user.json
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    // Authenticated tests — reuse saved session, no repeated logins
    {
      name: "authenticated",
      testMatch: "**/authenticated.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
    },
  ],
  // Do NOT auto-start a dev server — run `npm run dev` separately before testing
});
