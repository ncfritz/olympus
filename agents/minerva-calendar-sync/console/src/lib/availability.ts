import type { AvailabilityStatus, FreeBusyStatus } from "./api/queries";

/**
 * A unified row for both real tracked-calendar events and the synthetic
 * entries synthesized for override blocks with no underlying tracked
 * event (the "Overrides" pseudo-source) — see EventsPanel. Shared between
 * the calendar view and the list view so both render the same flag/status
 * styling off the same shape.
 */
export interface CalendarEntry {
  id: string;
  subject: string;
  source: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  cancelled: boolean;
  deleted: boolean;
  type: string;
  /** Only set for real events (isOverrideBlock: false) — the synced free/busy status. */
  freeBusyStatus?: FreeBusyStatus;
  /** True for a synthetic "Overrides" pseudo-source row (an override block with no associated tracked event). */
  isOverrideBlock: boolean;
  /** For a real event: the effective override applied to it, if any (block wins over a per-event override). For a pseudo row: the block's own status. */
  overrideStatus?: AvailabilityStatus;
  /** True only when `overrideStatus` comes from a per-event override — never true for a pseudo row, and false when an overlapping block is what's actually in effect, since clearing the (dominated) per-event override wouldn't change anything visible. Gates the right-click menu's "Clear" item. */
  hasEventOverride?: boolean;
}

/** Mirrors apps/api/src/domain/availability.ts's mapFreeBusyToAvailability — not a source of truth. */
export function mapFreeBusyToAvailability(
  status: FreeBusyStatus,
): AvailabilityStatus {
  switch (status) {
    case "busy":
      return "busy";
    case "tentative":
      return "interruptable";
    case "out_of_office":
    case "working_elsewhere":
      return "none";
    case "free":
      return "free";
  }
}

export const AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  "none",
  "free",
  "interruptable",
  "busy",
];

export const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  none: "None",
  free: "Free",
  interruptable: "Interruptable",
  busy: "Busy",
};

/** Friendly labels for the raw synced free/busy status — distinct from an override's STATUS_LABEL above. */
export const FREE_BUSY_LABEL: Record<FreeBusyStatus, string> = {
  busy: "Busy",
  free: "Free",
  tentative: "Tentative",
  out_of_office: "Out of Office",
  working_elsewhere: "Working Elsewhere",
};

/** Fill color for the 24px status dot in the event detail drawer. */
export function statusDotColor(status: AvailabilityStatus): string {
  switch (status) {
    case "none":
      return "#ffffff";
    case "free":
      return "#52c41a";
    case "interruptable":
      return "#fadb14";
    case "busy":
      return "#ff4d4f";
  }
}

/** Mirrors the precedence rule in apps/api/src/domain/availability.ts — kept here only for combining multiple overlapping override blocks client-side; not a source of truth. */
const PRECEDENCE: Record<AvailabilityStatus, number> = {
  none: 0,
  free: 1,
  interruptable: 2,
  busy: 3,
};

export function combineAvailability(
  statuses: AvailabilityStatus[],
): AvailabilityStatus {
  return statuses.reduce((best, status) =>
    PRECEDENCE[status] > PRECEDENCE[best] ? status : best,
  );
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(aEnd).getTime() > new Date(bStart).getTime()
  );
}

export type FlagStyle = { backgroundColor?: string; backgroundImage?: string };

function stripe(color: string): string {
  return `repeating-linear-gradient(45deg, ${color}, ${color} 3px, #ffffff 3px, #ffffff 6px)`;
}

/**
 * Left-bar flag colors for un-overridden synced events, following
 * Outlook's own free/busy convention
 * (https://learn.microsoft.com/en-us/answers/questions/4524589): Free is
 * blank, Busy is solid blue, Tentative is blue stripes, and Out of
 * Office/Working Elsewhere is solid purple. Our 4-value model maps "none"
 * (which is exactly OOO + working elsewhere) onto that purple.
 */
const BUSY_FLAG = "#0078d4";
const TENTATIVE_STRIPE = stripe("#0078d4");
const OOO_FLAG = "#7719aa";
const FREE_FLAG = "#e6e6e6";

function syncedFlagStyle(status: AvailabilityStatus): FlagStyle {
  switch (status) {
    case "busy":
      return { backgroundColor: BUSY_FLAG };
    case "interruptable":
      return { backgroundImage: TENTATIVE_STRIPE };
    case "none":
      return { backgroundColor: OOO_FLAG };
    case "free":
      return { backgroundColor: FREE_FLAG };
  }
}

/**
 * The left-bar flag style for an entry — used for the calendar view's
 * per-event flag and, identically, for the list view's left border on the
 * Subject/Status columns. An override — whether a standalone block or one
 * applied to a real event — is a deliberate user decision, not a synced
 * provider status, so it always gets a striped pattern (distinct from the
 * solid/blank Outlook palette used for un-overridden synced events below),
 * colored per the same none/free/interruptable/busy palette as the
 * drawer's status dot (statusDotColor) — except "none", whose dot color is
 * white and would be invisible as a stripe on a white background, so it
 * gets a plain grey stripe instead.
 */
export function flagFor(entry: CalendarEntry): FlagStyle {
  const isOverridden =
    entry.isOverrideBlock || entry.overrideStatus !== undefined;
  if (isOverridden) {
    const status = entry.overrideStatus!;
    return {
      backgroundImage: stripe(
        status === "none" ? "#8c8c8c" : statusDotColor(status),
      ),
    };
  }
  return syncedFlagStyle(mapFreeBusyToAvailability(entry.freeBusyStatus!));
}

/** The friendly status label to pair with flagFor's color: the override's label when overridden, otherwise the original meeting's own free/busy label. */
export function statusLabelFor(entry: CalendarEntry): string {
  const isOverridden =
    entry.isOverrideBlock || entry.overrideStatus !== undefined;
  return isOverridden
    ? STATUS_LABEL[entry.overrideStatus!]
    : FREE_BUSY_LABEL[entry.freeBusyStatus!];
}
