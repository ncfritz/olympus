const STORAGE_KEY = "minerva:themeMode";

export type ThemeMode = "light" | "dark" | "system";

export function defaultThemeMode(): ThemeMode {
  return "system";
}

export function loadThemeMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
    return defaultThemeMode();
  } catch {
    return defaultThemeMode();
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Best-effort — a private window or blocked storage just means the choice doesn't survive a reload.
  }
}
