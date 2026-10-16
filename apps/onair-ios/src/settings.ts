/*
 * The user's working day, as Settings sets it. Pure: no React Native, so it
 * is unit-tested. The API reads availability against it (dayStart, dayEnd,
 * includeWeekends), so outside it the user is clear unless an override or a
 * meeting they set says otherwise.
 */

export type WorkSettings = {
  /** Minutes after local midnight. */
  dayStart: number;
  /** Minutes after local midnight, after `dayStart`. */
  dayEnd: number;
  /** Saturday and Sunday are not working days. */
  weekendsFree: boolean;
  /** Calendars (by source label) whose events this phone does not show. */
  hiddenCalendars: string[];
  /** Face ID or Touch ID in front of OnAir's passcode. */
  useBiometrics: boolean;
};

export const DEFAULT_SETTINGS: WorkSettings = {
  dayStart: 8 * 60,
  dayEnd: 18 * 60,
  weekendsFree: true,
  hiddenCalendars: [],
  useBiometrics: false,
};

const MINUTES_IN_DAY = 24 * 60;

const isMinute = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < MINUTES_IN_DAY;

/** Whether a start and end make a working day: the end after the start. */
export const validHours = (dayStart: number, dayEnd: number): boolean =>
  isMinute(dayStart) && isMinute(dayEnd) && dayEnd > dayStart;

/** Stored settings, or the defaults for anything missing or not right. */
export const parseSettings = (stored: string | null): WorkSettings => {
  if (stored === null) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(stored) as Partial<WorkSettings>;
    const hours =
      isMinute(value.dayStart) &&
      isMinute(value.dayEnd) &&
      validHours(value.dayStart, value.dayEnd)
        ? { dayStart: value.dayStart, dayEnd: value.dayEnd }
        : {
            dayStart: DEFAULT_SETTINGS.dayStart,
            dayEnd: DEFAULT_SETTINGS.dayEnd,
          };
    return {
      ...hours,
      weekendsFree:
        typeof value.weekendsFree === "boolean"
          ? value.weekendsFree
          : DEFAULT_SETTINGS.weekendsFree,
      hiddenCalendars: Array.isArray(value.hiddenCalendars)
        ? value.hiddenCalendars.filter(
            (source): source is string => typeof source === "string",
          )
        : DEFAULT_SETTINGS.hiddenCalendars,
      useBiometrics:
        typeof value.useBiometrics === "boolean"
          ? value.useBiometrics
          : DEFAULT_SETTINGS.useBiometrics,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const hhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The API's working-day query for these settings. */
export const workingDayQuery = (
  settings: WorkSettings,
): { dayStart: string; dayEnd: string; includeWeekends: boolean } => ({
  dayStart: hhmm(settings.dayStart),
  dayEnd: hhmm(settings.dayEnd),
  includeWeekends: !settings.weekendsFree,
});

/** Minutes after midnight of a time of day. */
export const minutesOf = (at: Date): number =>
  at.getHours() * 60 + at.getMinutes();

/** Today at `minutes` after midnight: for a time picker. */
export const timeToday = (minutes: number, today = new Date()): Date =>
  new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  );

/** 8a, 12:30p: the day strip's short labels. */
export const shortTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  const rest =
    minutes % 60 === 0 ? "" : `:${String(minutes % 60).padStart(2, "0")}`;
  return `${twelve}${rest}${hours < 12 ? "a" : "p"}`;
};

/** 8:00 AM: where a time of day stands alone. */
export const longTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};
