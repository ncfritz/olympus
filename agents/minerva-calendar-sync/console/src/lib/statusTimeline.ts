import type { AvailabilityStatus, StatusTimeline } from "./api/queries";

const CHUNK_MS = 15 * 60 * 1000;

/**
 * Muted colors for the calendar's per-15-minute status strip — deliberately
 * flat (no stripe) and semi-transparent (see globals.css's opacity on
 * ".status-timeline-event"), dimmer than the vivid palette used for the
 * flag bar/status chip elsewhere, since this renders as a thin always-on
 * indicator rather than a one-off event's own status.
 */
export function mutedTimelineColor(status: AvailabilityStatus): string {
  switch (status) {
    case "none":
      return "#d9d9d9";
    case "free":
      return "#b7eb8f";
    case "interruptable":
      return "#ffe58f";
    case "busy":
      return "#ffa39e";
  }
}

/**
 * Collapses adjacent same-status 15-minute chunks into contiguous ranges,
 * so an hour of uninterrupted "busy" renders as one background event
 * instead of four identically-colored ones stacked with visible seams.
 */
export function mergeTimelineChunks(
  timeline: StatusTimeline,
): { start: string; end: string; status: AvailabilityStatus }[] {
  const sortedMinutes = Object.keys(timeline)
    .map(Number)
    .sort((a, b) => a - b);

  const merged: { start: string; end: string; status: AvailabilityStatus }[] =
    [];
  for (const minute of sortedMinutes) {
    const status = timeline[String(minute)];
    const startMs = minute * 60_000;
    const endMs = startMs + CHUNK_MS;
    const last = merged[merged.length - 1];

    if (last && last.status === status && Date.parse(last.end) === startMs) {
      last.end = new Date(endMs).toISOString();
    } else {
      merged.push({
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        status,
      });
    }
  }
  return merged;
}
