/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const hasMatchMedia = typeof window.matchMedia === "function";
      const systemTheme = hasMatchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);

      if (hasMatchMedia) {
        // Listen for system changes
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
          root.classList.remove("light", "dark");
          root.classList.add(e.matches ? "dark" : "light");
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
