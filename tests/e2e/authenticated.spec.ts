/**
 * Authenticated smoke tests.
 *
 * Session is pre-loaded from playwright/.auth/user.json (written by auth.setup.ts),
 * so no login() call is needed here. Tests navigate directly to each page.
 *
 * These tests require real Supabase credentials set in the environment:
 *   TEST_USER_EMAIL   — a valid test account email
 *   TEST_USER_PASSWORD — its password
 *
 * If the env vars are not set, all tests in this file are skipped.
 */
import { test, expect } from "@playwright/test";

const EMAIL    = process.env.TEST_USER_EMAIL    ?? "";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

test.beforeAll( () => {
  if ( !EMAIL || !PASSWORD ) {
    console.warn( "⚠️  TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping authenticated tests" );
  }
} );

test.describe( "Authenticated — smoke tests", () => {
  test.skip( !EMAIL || !PASSWORD, "TEST_USER_EMAIL / TEST_USER_PASSWORD not set" );

  // Block Next.js prefetch requests so the router cache stays empty.
  // Without this, sidebar links are prefetched after the first page loads, and the
  // router intercepts subsequent page.goto() calls as client-side navigations,
  // causing ERR_ABORTED because Playwright initiated a hard navigation.
  test.beforeEach( async ( { page } ) => {
    await page.route( "**/*", async ( route ) => {
      const headers = route.request().headers();
      if ( headers["next-router-prefetch"] ) {
        await route.abort();
      } else {
        await route.continue();
      }
    } );
  } );

  test( "dashboard loads with main sections", async ( { page } ) => {
    await page.goto( "/dashboard" );
    await expect( page.getByRole( "heading", { name: "Dashboard" } ) ).toBeVisible( { timeout: 10000 } );
    await expect( page.getByRole( "link", { name: /transactions/i } ) ).toBeVisible();
  } );

  test( "transactions page loads", async ( { page } ) => {
    await page.goto( "/transactions" );
    await expect( page ).toHaveURL( /transactions/ );
    await expect( page.getByRole( "heading", { name: "Transactions" } ) ).toBeVisible( { timeout: 10000 } );
  } );

  test( "accounts page loads", async ( { page } ) => {
    await page.goto( "/accounts" );
    await expect( page.getByRole( "heading", { name: "Accounts" } ) ).toBeVisible( { timeout: 10000 } );
  } );

  test( "budgets page loads", async ( { page } ) => {
    await page.goto( "/budgets" );
    await expect( page.getByRole( "heading", { name: "Budgets" } ) ).toBeVisible( { timeout: 10000 } );
  } );

  test( "categories page loads", async ( { page } ) => {
    await page.goto( "/categories" );
    await expect( page.getByRole( "heading", { name: "Categories" } ) ).toBeVisible( { timeout: 10000 } );
  } );

  test( "settings page loads with all cards", async ( { page } ) => {
    await page.goto( "/settings" );
    await expect( page.getByRole( "heading", { name: "Profile" } ) ).toBeVisible( { timeout: 10000 } );
    await expect( page.getByRole( "heading", { name: "Security" } ) ).toBeVisible();
    await expect( page.getByRole( "heading", { name: "Danger Zone" } ) ).toBeVisible();
  } );

  test( "sign out works", async ( { page } ) => {
    await page.goto( "/settings" );
    await page.getByRole( "button", { name: "Sign out" } ).click();
    await expect( page ).toHaveURL( /login/, { timeout: 8000 } );
  } );
} );
