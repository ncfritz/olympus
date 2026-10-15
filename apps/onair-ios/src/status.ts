/*
 * Availability in the words and colours the app shows (ADR 0029).
 *
 * The site says the same things in `apps/site/src/utils/onair.ts` and
 * `meetingAvailability.ts`; phase 2 of the plan moves both to one shared
 * package. Until then this mirrors them and must agree with them.
 *
 * Pure: imported by the unit tests, so nothing here may reach React Native
 * (`test/unit/boundary.spec.ts`).
 */

/** The API's `AvailabilityLevel`, lowest to highest. */
export type Level = "none" | "free" | "interruptable" | "busy";

/** The words the app and the site use for a level. */
export type OnAirStatus = "dnd" | "interrupt" | "free" | "clear";

const TO_ONAIR: Record<Level, OnAirStatus> = {
  busy: "dnd",
  interruptable: "interrupt",
  free: "free",
  none: "clear",
};

const TO_LEVEL: Record<OnAirStatus, Level> = {
  dnd: "busy",
  interrupt: "interruptable",
  free: "free",
  clear: "none",
};

/** In the order the pickers list them. */
export const STATUSES: readonly OnAirStatus[] = [
  "dnd",
  "interrupt",
  "free",
  "clear",
];

export const LABELS: Record<OnAirStatus, string> = {
  dnd: "Do Not Disturb",
  interrupt: "Interruptable",
  free: "Free",
  clear: "Clear",
};

export const toOnAirStatus = (level: Level): OnAirStatus =>
  TO_ONAIR[level] ?? "clear";

export const toLevel = (status: OnAirStatus): Level =>
  TO_LEVEL[status] ?? "none";

/** Whether the light is on: busy or interruptable. */
export const isOnAir = (level: Level | undefined): boolean =>
  level === "busy" || level === "interruptable";

/**
 * A meeting's level with nothing set by the user, as the API derives it from
 * the calendar's free/busy status (`levelOfMeetingStatus`). An unknown status
 * counts as busy, the safe side for a sign that says whether to come in.
 */
export const levelOfCalendarStatus = (status: string): Level => {
  switch (status) {
    case "Free":
      return "free";
    case "Tentative":
      return "interruptable";
    case "OOF":
    case "WorkingElsewhere":
      return "none";
    default:
      return "busy";
  }
};
