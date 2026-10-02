"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ApiError, apiRequest } from "@/lib/api";

export type Theme = "light" | "dark" | "system";
export type Currency = "USD" | "PKR" | "EUR" | "GBP" | "AED" | "CAD" | "AUD" | "JPY";
export const SUPPORTED_CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED", "CAD", "AUD", "JPY"] as const;
export const DEFAULT_CURRENCY: Currency = "USD";

export const isSupportedCurrency = (value: unknown): value is Currency =>
  typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);

export const resolveCurrency = (value: unknown): Currency =>
  isSupportedCurrency(value) ? value : DEFAULT_CURRENCY;

export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
export type Language = "en" | "ur" | "es" | "fr" | "de" | "ja";

export interface Preferences {
  theme: Theme;
  compactMode: boolean;
  currency: Currency;
  dateFormat: DateFormat;
  language: Language;
}

interface PreferencesContextType {
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  updatePreferences: (partial: Partial<Preferences>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: Preferences = {
  theme: "light",
  compactMode: false,
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  language: "en",
};

const STORAGE_KEY = "finflow.preferences";

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const loadInitialPreferences = (): Preferences => {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load preferences:", error);
  }

  return defaultPreferences;
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<Preferences>(loadInitialPreferences);
  const [hasHydratedFromApi, setHasHydratedFromApi] = useState(false);

  // Apply theme to document
  useEffect(() => {
    const applyTheme = (theme: Theme) => {
      const root = document.documentElement;
      
      if (theme === "system") {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const applySystemTheme = () => {
          if (mediaQuery.matches) {
            root.classList.add("dark");
          } else {
            root.classList.remove("dark");
          }
        };
        
        applySystemTheme();
        mediaQuery.addEventListener("change", applySystemTheme);
        
        return () => mediaQuery.removeEventListener("change", applySystemTheme);
      } else if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    const cleanup = applyTheme(preferences.theme);
    return cleanup;
  }, [preferences.theme]);

  // Save to localStorage whenever preferences change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  }, [preferences]);

  // Hydrate preferences from backend
  useEffect(() => {
    let cancelled = false;

    const fetchPreferences = async () => {
      try {
        const response = await apiRequest<{ preferences: Preferences }>("/auth/preferences", {
          method: "GET",
          auth: true,
        });

        if (!cancelled && response.preferences) {
          setPreferencesState((prev) => ({ ...prev, ...response.preferences }));
          setHasHydratedFromApi(true);
        }
      } catch {
        if (!cancelled) {
          setHasHydratedFromApi(true);
        }
      }
    };

    void fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreferences = (newPreferences: Preferences) => {
    setPreferencesState(newPreferences);
  };

  const updatePreferences = (partial: Partial<Preferences>) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...partial };
      const changed = (Object.keys(partial) as Array<keyof Preferences>).some(
        (key) => prev[key] !== next[key]
      );

      if (!changed) {
        return prev;
      }

      if (hasHydratedFromApi) {
        void apiRequest<{ message: string; preferences: Preferences }>("/auth/preferences", {
          method: "PUT",
          auth: true,
          body: JSON.stringify({ preferences: next }),
        }).catch((error) => {
          if (error instanceof ApiError) {
            console.error("Failed to persist preferences:", error.message);
          } else {
            console.error("Failed to persist preferences");
          }
        });
      }

      return next;
    });
  };

  const resetPreferences = () => {
    setPreferencesState(defaultPreferences);
  };

  return (
    <PreferencesContext.Provider
      value={{ preferences, setPreferences, updatePreferences, resetPreferences }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}

// Utility functions for formatting

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  PKR: "Rs",
  EUR: "€",
  GBP: "£",
  AED: "AED",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
};

export const LANGUAGE_LOCALES: Record<Language, string> = {
  en: "en-US",
  ur: "ur-PK",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
};

export const getCurrencySymbol = (currency: Currency): string => CURRENCY_SYMBOLS[currency];
export const getLocaleForLanguage = (language: Language): string => LANGUAGE_LOCALES[language];

export function formatMoney(amount: number, currency: Currency, language: Language = "en"): string {
  const locale = getLocaleForLanguage(language);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if Intl fails
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}

export function formatDate(date: Date | string, format: DateFormat): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }
  
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  
  switch (format) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    default:
      return `${month}/${day}/${year}`;
  }
}
