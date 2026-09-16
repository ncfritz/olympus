import type { AvailabilityStatus, FreeBusyStatus } from "./api/queries";

/** Mirrors apps/api/src/domain/availability.ts's mapFreeBusyToAvailability — not a source of truth. */
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

export const AVAILABILITY_STATUSES: AvailabilityStatus[] = ["none", "free", "interruptable", "busy"];

export const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  none: "None",
  free: "Free",
  interruptable: "Interruptable",
  busy: "Busy",
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
const PRECEDENCE: Record<AvailabilityStatus, number> = { none: 0, free: 1, interruptable: 2, busy: 3 };

export function combineAvailability(statuses: AvailabilityStatus[]): AvailabilityStatus {
  return statuses.reduce((best, status) => (PRECEDENCE[status] > PRECEDENCE[best] ? status : best));
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime();
}

export function availabilityColor(status: AvailabilityStatus): string {
  switch (status) {
    case "busy":
      return "red";
    case "interruptable":
      return "gold";
    case "free":
      return "green";
    case "none":
      return "default";
  }
}
