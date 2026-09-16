import { FreeBusyStatus } from "./canonical-event";

/**
 * The four-level status shown on the availability grid — distinct from
 * FreeBusyStatus, which is the raw value synced from the calendar
 * provider. Every provider status maps down to one of these.
 */
export const AVAILABILITY_STATUS_VALUES = ["none", "free", "interruptable", "busy"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUS_VALUES)[number];

/**
 * Precedence when multiple meetings (or override blocks) overlap the same
 * slot — the highest-ranked status wins. "none" ranks lowest: it's what
 * out-of-office/working-elsewhere events contribute, and is only ever the
 * final answer when nothing more informative overlaps the slot.
 */
const AVAILABILITY_PRECEDENCE: Record<AvailabilityStatus, number> = {
  none: 0,
  free: 1,
  interruptable: 2,
  busy: 3,
};

export function mapFreeBusyToAvailability(status: FreeBusyStatus): AvailabilityStatus {
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

/** Combines two or more overlapping statuses into one, per AVAILABILITY_PRECEDENCE. Callers handle the zero-overlap case (which is "free", not a combine). */
export function combineAvailability(statuses: AvailabilityStatus[]): AvailabilityStatus {
  if (statuses.length === 0) {
    throw new Error("combineAvailability requires at least one status");
  }
  return statuses.reduce((best, status) =>
    AVAILABILITY_PRECEDENCE[status] > AVAILABILITY_PRECEDENCE[best] ? status : best,
  );
}

/** One computed 15-minute slot on the availability grid. */
export interface AvailabilitySlot {
  /** ISO-8601 */
  startTime: string;
  /** ISO-8601 */
  endTime: string;
  status: AvailabilityStatus;
}

/**
 * Overrides the computed status for one specific synced meeting, keyed by
 * its canonical event id (`source:uid`, see buildCanonicalEventId) rather
 * than the Event row's own id/FK. This is deliberate: overrides must
 * survive the Event table being wiped and fully re-synced from the
 * provider, since the override itself has no provider-side counterpart —
 * it's purely local state layered on top of synced data.
 */
export interface EventOverride {
  eventId: string;
  status: AvailabilityStatus;
}

/**
 * An independent block of time on the internal "Overrides" calendar — not
 * tied to any synced meeting. Takes precedence over everything else when
 * computing a slot's status.
 */
export interface OverrideBlock {
  id: string;
  /** ISO-8601 */
  startTime: string;
  /** ISO-8601 */
  endTime: string;
  status: AvailabilityStatus;
  label: string | null;
}
