/**
 * Screenshot capture script for hero page demo preview.
 * Run with:  npx ts-node --project tsconfig.json tests/screenshots.ts
 * Or via:    npx playwright test tests/screenshots.spec.ts
 *
 * Saves screenshots to public/ so next/image can serve them.
 */
import { chromium } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: ".env.local" });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_USER_EMAIL ?? "";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

const PAGES = [
  { name: "demo-dashboard", path: "/dashboard" },
  { name: "demo-ai-chat",   path: "/ai-chat" },
  { name: "demo-budgets",   path: "/budgets" },
];

(async () => {
  if (!EMAIL || !PASSWORD) {
    console.error("❌  TEST_USER_EMAIL / TEST_USER_PASSWORD not set in .env.local");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2, // retina quality
  });
  const page = await context.newPage();

  // ── Login ──────────────────────────────────────────────────────────────────
  console.log("🔑  Logging in…");
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("••••••••").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  console.log("✅  Logged in");

  // ── Capture each page ──────────────────────────────────────────────────────
  const outDir = path.join(process.cwd(), "public");

  for (const { name, path: pagePath } of PAGES) {
    console.log(`📸  Capturing ${pagePath}…`);
    await page.goto(`${BASE_URL}${pagePath}`);

    // Wait for network idle so charts/data are rendered
    await page.waitForLoadState("networkidle");
    // Extra settle time for animations
    await page.waitForTimeout(800);

    const outPath = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`   ✓  Saved → public/${name}.png`);
  }

  await browser.close();
  console.log("\n🎉  All screenshots saved to public/");
})();
