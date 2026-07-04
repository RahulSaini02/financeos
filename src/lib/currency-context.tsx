"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import type { CurrencyCode } from "@/lib/types";

interface CurrencyContextValue {
  currency: CurrencyCode;
  fxRate: number;
  fmt: (amount: number, fromCurrency?: CurrencyCode) => string;
}

const DEFAULT_FX = 84;

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  fxRate: 1,
  fmt: (amount) => formatCurrency(amount, "USD"),
});

export function BaseCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    if (typeof window === "undefined") return "USD";
    return (localStorage.getItem("pref_default_currency") as CurrencyCode) || "USD";
  });
  const [fxRate, setFxRate] = useState<number>(1);

  const fetchFxRate = useCallback(async () => {
    try {
      const res = await fetch("/api/fx?from=USD&to=INR");
      if (res.ok) {
        const { rate } = (await res.json()) as { rate: number | null };
        setFxRate(rate ?? DEFAULT_FX);
      }
    } catch {
      setFxRate(DEFAULT_FX);
    }
  }, []);

  // Fetch FX rate on mount if the stored currency is INR
  useEffect(() => {
    if (currency === "INR") fetchFxRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onCurrencyChanged = (e: Event) => {
      const c = (e as CustomEvent<CurrencyCode>).detail;
      setCurrency(c);
      if (c === "INR") fetchFxRate();
      else setFxRate(1);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pref_default_currency" && e.newValue) {
        const c = e.newValue as CurrencyCode;
        setCurrency(c);
        if (c === "INR") fetchFxRate();
        else setFxRate(1);
      }
    };
    window.addEventListener("currency-changed", onCurrencyChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("currency-changed", onCurrencyChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchFxRate]);

  const fmt = useCallback(
    (amount: number, fromCurrency: CurrencyCode = "USD"): string => {
      let converted = amount;
      if (fromCurrency !== currency) {
        const rate = fxRate || DEFAULT_FX;
        if (fromCurrency === "USD" && currency === "INR") {
          converted = amount * rate;
        } else if (fromCurrency === "INR" && currency === "USD") {
          converted = amount / rate;
        }
      }
      return formatCurrency(converted, currency);
    },
    [currency, fxRate]
  );

  return (
    <CurrencyContext.Provider value={{ currency, fxRate, fmt }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
