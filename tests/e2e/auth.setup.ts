/**
 * Runs once before authenticated tests to log in and persist the session.
 * Saves cookies + localStorage to playwright/.auth/user.json so each
 * authenticated test can reuse the session without hitting Supabase again.
 */
import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = "playwright/.auth/user.json";

setup( "authenticate", async ( { page } ) => {
  const email    = process.env.TEST_USER_EMAIL    ?? "";
  const password = process.env.TEST_USER_PASSWORD ?? "";

  if ( !email || !password ) {
    // Write an empty state so the authenticated project can still be loaded
    fs.mkdirSync( path.dirname( AUTH_FILE ), { recursive: true } );
    fs.writeFileSync( AUTH_FILE, JSON.stringify( { cookies: [], origins: [] } ) );
    return;
  }

  await page.goto( "/login" );
  await page.getByPlaceholder( "you@example.com" ).fill( email );
  await page.getByPlaceholder( "••••••••" ).fill( password );
  await page.getByRole( "button", { name: "Sign In" } ).click();
  await page.waitForURL( ( url ) => !url.pathname.startsWith( "/login" ), { timeout: 20000 } );
  await expect( page ).toHaveURL( /dashboard/ );

  fs.mkdirSync( path.dirname( AUTH_FILE ), { recursive: true } );
  await page.context().storageState( { path: AUTH_FILE } );
} );
