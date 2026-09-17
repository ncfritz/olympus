const VIEW_COOKIE = "minerva:calendarView";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type CalendarDisplayMode = "list" | "month" | "week" | "day";

const VALID_MODES: readonly CalendarDisplayMode[] = [
  "list",
  "month",
  "week",
  "day",
];

function isCalendarDisplayMode(value: string): value is CalendarDisplayMode {
  return (VALID_MODES as readonly string[]).includes(value);
}

/** Reads the user's last-chosen calendar display mode, defaulting to "week". */
export function loadViewPreference(): CalendarDisplayMode {
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${VIEW_COOKIE}=`));
    const value = match?.split("=")[1];
    if (value && isCalendarDisplayMode(value)) return value;
  } catch {
    // Fall through to the default below.
  }
  return "week";
}

export function saveViewPreference(mode: CalendarDisplayMode): void {
  try {
    document.cookie = `${VIEW_COOKIE}=${mode}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  } catch {
    // Best-effort — a blocked cookie store just means the choice doesn't survive a reload.
  }
}
