"use client";

import { ConfigProvider, theme as antdTheme } from "antd";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultThemeMode,
  loadThemeMode,
  saveThemeMode,
  type ThemeMode,
} from "./theme";

interface ThemeModeContextValue {
  mode: ThemeMode;
  /** `mode` with "system" resolved against the OS/browser preference. */
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  return prefersDark;
}

/**
 * App-wide, not per-page — wraps the root layout (login screen included) so
 * the whole app, not just the authenticated area, follows the choice. Owns
 * both the persisted mode and the antd ConfigProvider that actually applies
 * it, since every themed antd component needs to sit under one.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === "undefined" ? defaultThemeMode() : loadThemeMode(),
  );
  const prefersDark = useSystemPrefersDark();
  const resolvedMode: "light" | "dark" =
    mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  function setMode(next: ThemeMode) {
    setModeState(next);
    saveThemeMode(next);
  }

  useEffect(() => {
    // color-scheme drives native form controls (e.g. the Settings drawer's
    // <input type="time">) and the scrollbar; data-theme drives globals.css.
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  const value = useMemo(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm:
            resolvedMode === "dark"
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm,
          components: {
            // Pinned to light mode's default rather than left to the
            // algorithm — the dark algorithm darkens component tokens
            // (including this one) same as everything else, which would
            // otherwise make the header a different color per mode.
            Layout: { headerBg: "#001529" },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used within a ThemeModeProvider");
  }
  return ctx;
}
