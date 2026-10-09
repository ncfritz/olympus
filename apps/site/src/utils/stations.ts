import type { WeatherStationReading } from "@ncfritz/olympus-sdk/olympus";
import { compassPoint } from "./weather";

/**
 * The Stations view's arithmetic (docs/plans/weather/README.md, phase 8),
 * kept out of the components so it can be tested without a DOM.
 */

/** How long ago a reading was: "12 s ago", "4 min ago", "3 h ago", "2 d ago". */
export const ago = (iso: string, now: number): string => {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const fixed = (value: number | undefined, digits: number, unit = "") =>
  value === undefined ? "—" : `${value.toFixed(digits)}${unit}`;

/** A temperature to a tenth: "57.2°". */
export const tenths = (value: number | undefined): string =>
  fixed(value, 1, "°");

export type StationTile = { label: string; value: string };

/** The twelve readings under a station's temperature, in the design's order. */
export const stationTiles = (reading: WeatherStationReading): StationTile[] => {
  const wind =
    reading.windSpeedMph === undefined
      ? "—"
      : reading.windSpeedMph === 0 || reading.windDirectionDeg === undefined
        ? `${reading.windSpeedMph.toFixed(1)} mph`
        : `${compassPoint(reading.windDirectionDeg)} ${reading.windSpeedMph.toFixed(1)} mph`;
  const uvSolar =
    reading.uvIndex === undefined && reading.solarRadiationWm2 === undefined
      ? "—"
      : `${reading.uvIndex ?? "—"} · ${
          reading.solarRadiationWm2 === undefined
            ? "—"
            : `${Math.round(reading.solarRadiationWm2)} W/m²`
        }`;
  const low = [
    reading.batteryOutdoorOk === false ? "outdoor" : undefined,
    reading.batteryIndoorOk === false ? "console" : undefined,
  ].filter(Boolean);
  const battery =
    low.length > 0
      ? `Low: ${low.join(", ")}`
      : reading.batteryOutdoorOk === undefined &&
          reading.batteryIndoorOk === undefined
        ? "—"
        : "OK";
  return [
    { label: "Feels like", value: tenths(reading.feelsLikeF) },
    { label: "Dew point", value: tenths(reading.dewPointF) },
    { label: "Humidity", value: fixed(reading.outdoorHumidityPct, 0, "%") },
    { label: "Wind", value: wind },
    { label: "Gust", value: fixed(reading.windGustMph, 1, " mph") },
    { label: "Pressure", value: fixed(reading.pressureRelativeInhg, 2, " in") },
    { label: "Rain rate", value: fixed(reading.rainRateInHr, 2, " in/h") },
    { label: "Rain today", value: fixed(reading.rainDailyIn, 2, " in") },
    { label: "UV / solar", value: uvSolar },
    { label: "Indoor", value: tenths(reading.indoorTemperatureF) },
    {
      label: "Indoor humidity",
      value: fixed(reading.indoorHumidityPct, 0, "%"),
    },
    { label: "Battery", value: battery },
  ];
};

export type SparkPoint = { time: string; value: number };

/**
 * A sparkline's polylines: each point placed by its time across
 * [from, to] and by its value between the series' low and high, inside
 * `width` × `height` less `pad`. A stretch longer than `maxGapMs` without
 * a point breaks the line rather than drawing across it.
 */
export const sparkline = (
  points: SparkPoint[],
  from: number,
  to: number,
  width: number,
  height: number,
  maxGapMs: number,
  pad = 3,
): string[] => {
  if (points.length === 0 || to <= from) return [];
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (time: number) =>
    Math.round(((time - from) / (to - from)) * width * 10) / 10;
  const y = (value: number) =>
    high === low
      ? height / 2
      : Math.round((pad + ((high - value) / span) * (height - 2 * pad)) * 10) /
        10;

  const lines: string[][] = [];
  let previous: number | undefined;
  for (const point of points) {
    const time = Date.parse(point.time);
    if (previous === undefined || time - previous > maxGapMs) lines.push([]);
    lines[lines.length - 1].push(`${x(time)},${y(point.value)}`);
    previous = time;
  }
  return lines.map((line) => line.join(" "));
};

/** The low and high of a series, or undefined when it is empty. */
export const lowHigh = (
  points: { min?: number; max?: number; mean: number }[],
): { low: number; high: number } | undefined =>
  points.length === 0
    ? undefined
    : {
        low: Math.min(...points.map((point) => point.min ?? point.mean)),
        high: Math.max(...points.map((point) => point.max ?? point.mean)),
      };

/** A station's name: 1 to 100 characters, as the API allows. */
export const MAX_STATION_NAME = 100;

/**
 * A console's MAC address as the API stores it (upper case, colons), or
 * undefined if it is not one. Colons, dashes, dots or none are all fine.
 */
export const normalizeMac = (value: string | undefined): string | undefined => {
  const hex = value?.replace(/[:.-]/g, "").trim().toUpperCase();
  if (!hex || !/^[0-9A-F]{12}$/.test(hex)) return undefined;
  return hex.match(/../g)!.join(":");
};

/** The message in an API error's body, if it has one. */
export const apiErrorMessage = (error: unknown): string | undefined => {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === "string" && message ? message : undefined;
};
