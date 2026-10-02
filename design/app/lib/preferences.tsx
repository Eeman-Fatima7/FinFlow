import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type Currency = "USD" | "PKR" | "EUR" | "GBP" | "AED" | "CAD" | "AUD" | "JPY";
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
  theme: "system",
  compactMode: false,
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  language: "en",
};

const STORAGE_KEY = "finflow.preferences";

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<Preferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
    return defaultPreferences;
  });

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  }, [preferences]);

  const setPreferences = (newPreferences: Preferences) => {
    setPreferencesState(newPreferences);
  };

  const updatePreferences = (partial: Partial<Preferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...partial }));
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

const currencySymbols: Record<Currency, string> = {
  USD: "$",
  PKR: "Rs",
  EUR: "€",
  GBP: "£",
  AED: "AED",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
};

const localeMap: Record<Language, string> = {
  en: "en-US",
  ur: "ur-PK",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
};

export function formatMoney(amount: number, currency: Currency, language: Language = "en"): string {
  const locale = localeMap[language];
  
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback if Intl fails
    const symbol = currencySymbols[currency];
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
