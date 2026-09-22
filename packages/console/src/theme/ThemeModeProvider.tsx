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
} from "./themeMode";

export interface ThemeModeContextValue {
  mode: ThemeMode;
  /** `mode` with "system" resolved against the OS/browser preference. */
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

const useSystemPrefersDark = (): boolean => {
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return prefersDark;
};

/**
 * Suite-wide, not per-page: it wraps the root layout, sign-in screen
 * included, so the whole console follows the choice. It owns both the
 * stored mode and the antd ConfigProvider that applies it, since every
 * themed antd component has to sit under one.
 *
 * The mode is per browser and per console origin. Every console on the
 * control host shares one origin, so choosing dark in one is choosing it
 * for the suite.
 */
export const ThemeModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === "undefined" ? defaultThemeMode() : loadThemeMode(),
  );
  const prefersDark = useSystemPrefersDark();
  const resolvedMode: "light" | "dark" =
    mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    saveThemeMode(next);
  };

  useEffect(() => {
    // color-scheme drives native form controls and the scrollbar;
    // data-theme drives each console's globals.css.
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
            // algorithm, which would darken it along with everything else
            // and make the chrome a different colour per mode.
            Layout: { headerBg: "#001529", siderBg: "#001529" },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = (): ThemeModeContextValue => {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within a ThemeModeProvider");
  }
  return context;
};
