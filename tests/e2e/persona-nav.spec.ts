// Validation checkpoint for persona-based onboarding (Sprint 7/3 · 3).
// Pure mapping tests — verifies each persona's default tab set. The set is only
// a seed for NAV_PREFS_KEY (the same localStorage prefs the Settings show/hide
// panel edits), so nothing is ever locked post-onboarding.
import { test, expect } from "@playwright/test";
import { defaultVisibleHrefs, personaNavLabel } from "../../src/lib/persona-nav";
import type { Persona } from "../../src/lib/types";

const PERSONAS: Persona[] = [
  "student", "freelancer", "employed", "business_owner", "trader", "between_jobs",
];

test.describe("Persona → default tab visibility", () => {
  test("dashboard and AI review stay visible for every persona and scope", () => {
    for (const persona of PERSONAS) {
      for (const scope of ["spending", "spending_savings", "full"] as const) {
        const visible = defaultVisibleHrefs(persona, scope);
        expect(visible, `${persona}/${scope}`).not.toBeNull();
        expect(visible!.has("/dashboard"), `${persona}/${scope} dashboard`).toBe(true);
        expect(visible!.has("/ai-review"), `${persona}/${scope} ai-review`).toBe(true);
      }
    }
  });

  test("'other' persona shows everything (null = no filtering)", () => {
    expect(defaultVisibleHrefs("other", "full")).toBeNull();
    expect(defaultVisibleHrefs("other", "spending")).toBeNull();
  });

  test("student defaults match the PRD set", () => {
    const visible = defaultVisibleHrefs("student", "spending_savings")!;
    for (const href of ["/dashboard", "/transactions", "/budgets", "/savings-goals", "/categories"]) {
      expect(visible.has(href), href).toBe(true);
    }
    expect(visible.has("/paychecks")).toBe(false);
    expect(visible.has("/investments")).toBe(false);
  });

  test("employed adds accounts, paychecks, and bills on top of student set", () => {
    const visible = defaultVisibleHrefs("employed", "spending_savings")!;
    for (const href of ["/accounts", "/paychecks", "/subscriptions"]) {
      expect(visible.has(href), href).toBe(true);
    }
  });

  test("trader keeps investments even in spending-only scope", () => {
    const visible = defaultVisibleHrefs("trader", "spending")!;
    expect(visible.has("/investments")).toBe(true);
    expect(visible.has("/savings-goals")).toBe(false);
  });

  test("spending-only scope trims wealth tabs; full picture adds them back", () => {
    const spending = defaultVisibleHrefs("student", "spending")!;
    expect(spending.has("/savings-goals")).toBe(false);
    expect(spending.has("/loans")).toBe(false);

    const full = defaultVisibleHrefs("student", "full")!;
    for (const href of ["/accounts", "/savings-goals", "/investments", "/loans"]) {
      expect(full.has(href), href).toBe(true);
    }
  });
});

test.describe("Persona tab relabeling (display-only)", () => {
  test("freelancer and trader see Paychecks as Income", () => {
    expect(personaNavLabel("/paychecks", "freelancer")).toBe("Income");
    expect(personaNavLabel("/paychecks", "trader")).toBe("Income");
  });

  test("other personas keep default labels", () => {
    expect(personaNavLabel("/paychecks", "employed")).toBeNull();
    expect(personaNavLabel("/transactions", "freelancer")).toBeNull();
    expect(personaNavLabel("/paychecks", null)).toBeNull();
  });
});
