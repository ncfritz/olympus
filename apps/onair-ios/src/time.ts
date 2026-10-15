import type { Level } from "./status";

/*
 * Time arithmetic for the availability the app loads. Pure.
 */

const SLOT_MS = 15 * 60 * 1000;

/** Local midnight to the next local midnight around `now`. */
export const dayAround = (now: Date): { start: Date; end: Date } => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

/** The level of the 15-minute slot `now` falls in, if the slots cover it. */
export const levelAt = (
  slots: readonly { startTime: string; status: Level }[],
  now: Date,
): Level | undefined => {
  const at = now.getTime();
  return slots.find((slot) => {
    const start = Date.parse(slot.startTime);
    return start <= at && at < start + SLOT_MS;
  })?.status;
};
