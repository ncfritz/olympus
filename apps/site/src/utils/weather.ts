/**
 * Pure helpers for the weather widget (docs/plans/weather/design.md): time
 * in a location's own offset, day labels, the 5-day range bars, and which
 * location the widget opens on. No React here, so they are unit-tested.
 */

/**
 * A timestamp as wall-clock time at a location. The forecast carries the
 * location's UTC offset rather than a zone name, so the time is shifted by
 * it and then read as UTC.
 */
const atOffset = (iso: string, utcOffsetSeconds: number): Date =>
  new Date(Date.parse(iso) + utcOffsetSeconds * 1000);

/** "2 PM", at the location. */
export const formatHour = (iso: string, utcOffsetSeconds: number): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    timeZone: "UTC",
  }).format(atOffset(iso, utcOffsetSeconds));

/** "12:50 PM", at the location. */
export const formatClock = (iso: string, utcOffsetSeconds: number): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(atOffset(iso, utcOffsetSeconds));

/** "Today" for the first day, otherwise the weekday: "Wed". */
export const dayLabel = (date: string, index: number): string =>
  index === 0
    ? "Today"
    : new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`));

/** A temperature as the widget shows it: "58°". */
export const degrees = (value: number): string => `${Math.round(value)}°`;

/** A chance of precipitation, or nothing when there is none worth saying. */
export const chance = (pct: number): string => (pct >= 10 ? `${pct}%` : "");

const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

/** The sixteen-point compass direction a wind blows from: 202° is "SSW". */
export const compassPoint = (degreesFromNorth: number): string =>
  COMPASS[Math.round((((degreesFromNorth % 360) + 360) % 360) / 22.5) % 16];

/**
 * Where each day's low-to-high bar sits on one scale shared by all five
 * days, as percentages of the track.
 */
export const rangeBars = (
  days: { lowF: number; highF: number }[],
): { left: number; width: number }[] => {
  if (days.length === 0) return [];
  const low = Math.min(...days.map((day) => day.lowF));
  const high = Math.max(...days.map((day) => day.highF));
  const span = high - low || 1;
  return days.map((day) => ({
    left: Math.round(((day.lowF - low) / span) * 100),
    width: Math.max(Math.round(((day.highF - day.lowF) / span) * 100), 2),
  }));
};

/**
 * The location the widget shows: the one picked this session if it still
 * exists, otherwise the default, otherwise the first.
 */
export const chooseLocation = (
  locations: { id: string; isDefault: boolean }[],
  picked?: string,
): string | undefined => {
  if (picked && locations.some((location) => location.id === picked)) {
    return picked;
  }
  return (locations.find((location) => location.isDefault) ?? locations[0])?.id;
};

/** The list with the item at `from` moved to `to`. */
export const moveItem = <T>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
};

/** The frame after `index` in a loop of `count`. */
export const nextFrame = (index: number, count: number): number =>
  count === 0 ? 0 : (index + 1) % count;
