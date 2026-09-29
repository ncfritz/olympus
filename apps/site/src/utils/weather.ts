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

/** The frame after `index` in a loop of `count`. */
export const nextFrame = (index: number, count: number): number =>
  count === 0 ? 0 : (index + 1) % count;

/**
 * Colours for temperatures (°F), coldest first. A temperature between two
 * stops is mixed between their colours, so one temperature is always one
 * colour, whichever day it appears in.
 */
export const TEMPERATURE_STOPS: [number, string][] = [
  [10, "#2f54eb"],
  [32, "#1677ff"],
  [45, "#13c2c2"],
  [58, "#52c41a"],
  [70, "#fadb14"],
  [82, "#fa8c16"],
  [95, "#f5222d"],
];

const hex = (color: string) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

/** The colour of a temperature, as `rgb(r, g, b)`. */
export const temperatureColor = (temperatureF: number): string => {
  const stops = TEMPERATURE_STOPS;
  if (temperatureF <= stops[0][0]) return rgb(hex(stops[0][1]));
  const last = stops[stops.length - 1];
  if (temperatureF >= last[0]) return rgb(hex(last[1]));
  const upper = stops.findIndex(([at]) => at >= temperatureF);
  const [fromAt, fromColor] = stops[upper - 1];
  const [toAt, toColor] = stops[upper];
  const t = (temperatureF - fromAt) / (toAt - fromAt);
  const a = hex(fromColor);
  const b = hex(toColor);
  return rgb(a.map((channel, i) => Math.round(channel + (b[i] - channel) * t)));
};

const rgb = ([r, g, b]: number[]) => `rgb(${r}, ${g}, ${b})`;

/**
 * A day's bar as a left-to-right gradient from its low to its high, with
 * every stop it passes on the way, so a bar crossing freezing shows the
 * blue-to-cyan turn where it happens rather than a smear of two ends.
 */
export const temperatureGradient = (lowF: number, highF: number): string => {
  if (highF <= lowF) return temperatureColor(lowF);
  const span = highF - lowF;
  const points = [
    lowF,
    ...TEMPERATURE_STOPS.map(([at]) => at).filter(
      (at) => at > lowF && at < highF,
    ),
    highF,
  ];
  const stops = points.map(
    (at) =>
      `${temperatureColor(at)} ${Math.round(((at - lowF) / span) * 100)}%`,
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
};
