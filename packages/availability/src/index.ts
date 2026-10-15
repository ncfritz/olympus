/*
 * Minerva availability (ADR 0029) in the words OnAir uses, shared by the
 * site's OnAir drawer and meetings pages and by the iPhone app, so the two
 * never disagree about what a level is called.
 *
 * Platform-free: the site and React Native both import it.
 */

/** The API's `AvailabilityLevel`, lowest to highest. */
export type Level = "none" | "free" | "interruptable" | "busy";

/** What OnAir calls a level: the drawer's words since the legacy service. */
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

/** The word for a level; anything unknown is clear. */
export const toOnAirStatus = (level: Level): OnAirStatus =>
  TO_ONAIR[level] ?? "clear";

/** The level for a word; anything else is none. */
export const toLevel = (status: string): Level =>
  TO_LEVEL[status as OnAirStatus] ?? "none";

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
