import { createContext } from "react";

/** What the user picked. `system` follows the OS preference live. */
export type ThemePreference = "light" | "dark" | "system";

/** What is actually painted. Never `system`. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "alertup-theme";

export interface ThemeContextValue {
  /** The stored preference, including `system`. */
  theme: ThemePreference;
  /** The theme currently on screen. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  /** Flips between light and dark, leaving `system` behind. */
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const getSystemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export const readStoredTheme = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    /* private mode / storage disabled — fall through to the default */
  }
  return "system";
};
