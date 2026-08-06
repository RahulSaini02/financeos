"use client";

import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";

interface AppTourProps {
  startTour: boolean;
}

// SECURITY: driver.js renders title/description via innerHTML.
// Never interpolate user-supplied data into these strings — hardcoded only.

// Desktop steps — highlight sidebar nav items (sidebar is always visible on lg+)
const desktopSteps = [
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: "Welcome to MyFinOS 👋",
      description:
        "This is your Dashboard — your financial command center. You'll see net worth, spending trends, budget alerts, and AI-generated insights here once you've added your data.",
    },
  },
  {
    element: '[data-tour="nav-accounts"]',
    popover: {
      title: "Step 1: Add Your Accounts",
      description:
        "Start by adding your bank accounts, credit cards, and investment accounts. Everything else — budgets, net worth, transactions — is anchored to your accounts.",
    },
  },
  {
    element: '[data-tour="nav-transactions"]',
    popover: {
      title: "Step 2: Track Transactions",
      description:
        "Log income and expenses here. You can add them manually one by one, or use Import to bulk-upload a CSV from your bank.",
    },
  },
  {
    element: '[data-tour="nav-import"]',
    popover: {
      title: "Bulk Import",
      description:
        "Have historical data? Upload a CSV export from your bank to import hundreds of transactions at once — great for getting started quickly.",
    },
  },
  {
    element: '[data-tour="nav-budgets"]',
    popover: {
      title: "Step 3: Set Budgets",
      description:
        "Create monthly spending limits by category. The Dashboard will alert you when you're approaching or over your budget.",
    },
  },
  {
    element: '[data-tour="nav-savings-goals"]',
    popover: {
      title: "Savings Goals",
      description:
        "Set a savings target, link it to an account, and track your progress toward it over time.",
    },
  },
  {
    element: '[data-tour="nav-recurring"]',
    popover: {
      title: "Recurring Payments",
      description:
        "Set up bills or payments that repeat — like rent or subscriptions. They'll auto-appear in your upcoming bills on the Dashboard.",
    },
  },
  {
    element: '[data-tour="nav-ai-review"]',
    popover: {
      title: "AI-Powered Review",
      description:
        "Each month, our AI reviews your spending patterns, compares them to prior months, and surfaces actionable insights. Request access from Settings to unlock it.",
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: "Settings & Customisation",
      description:
        "Manage your profile, show/hide nav items, and customise your AI prompts here. You can also replay this tour anytime from Settings.",
      side: "top",
    },
  },
  {
    popover: {
      title: "You're all set! 🎉",
      description:
        "Start by adding your first account — it only takes 30 seconds. From there, the whole app comes to life.",
    },
  },
];

// Mobile steps — unanchored center-screen popovers (sidebar is hidden in a drawer on mobile)
const mobileSteps = [
  {
    popover: {
      title: "Welcome to MyFinOS 👋",
      description:
        "Your financial command center. The Dashboard shows net worth, spending trends, budget alerts, and AI insights — all in one place.",
    },
  },
  {
    popover: {
      title: "Track Your Finances",
      description:
        "Use the navigation menu to access Accounts, Transactions, Budgets, and more. Start by adding your first account.",
    },
  },
  {
    popover: {
      title: "AI-Powered Insights",
      description:
        "MyFinOS includes an AI assistant and monthly spending reviews. Request AI access from Settings to unlock these features.",
    },
  },
  {
    popover: {
      title: "You're all set! 🎉",
      description:
        "Start by adding your first account — it only takes 30 seconds. From there, the whole app comes to life.",
    },
  },
];

export function AppTour({ startTour }: AppTourProps) {
  const driverRef = useRef<ReturnType<typeof import("driver.js")["driver"]> | null>(null);

  useEffect(() => {
    if (!startTour) return;

    let cancelled = false;

    async function initTour() {
      const { driver } = await import("driver.js");

      if (cancelled) return;

      // lg breakpoint is 1024px — matches Tailwind's `lg:` prefix used in AppShell
      const isMobile = window.innerWidth < 1024;

      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(0,0,0,0.75)",
        popoverClass: "financeos-tour-popover",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Get Started",
        onDestroyStarted: () => {
          localStorage.setItem("has_seen_tour", "true");
          window.dispatchEvent(new CustomEvent("tour-complete"));
          driverObj.destroy();
        },
        steps: isMobile ? mobileSteps : desktopSteps,
      });

      driverRef.current = driverObj;
      driverObj.drive();
    }

    initTour();

    return () => {
      cancelled = true;
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, [startTour]);

  return null;
}
