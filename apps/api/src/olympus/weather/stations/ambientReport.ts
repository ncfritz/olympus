import moment, { type Moment } from "moment";
import { dewPointF, feelsLikeF } from "../utils/meteorology";

/**
 * A reading as stored in `weather_station_samples`, keyed by the Hasura
 * column names. Every reading is optional: a console reports what its
 * sensors have, and nothing else.
 */
export type SampleReadings = {
  outdoorTemperatureF?: number;
  outdoorHumidityPct?: number;
  indoorTemperatureF?: number;
  indoorHumidityPct?: number;
  dewPointF?: number;
  feelsLikeF?: number;
  windSpeedMph?: number;
  windSpeedAvg10mMph?: number;
  windGustMph?: number;
  maxDailyGustMph?: number;
  windDirectionDeg?: number;
  windDirectionAvg10mDeg?: number;
  rainRateInHr?: number;
  rainEventIn?: number;
  rainDailyIn?: number;
  rainWeeklyIn?: number;
  rainMonthlyIn?: number;
  rainYearlyIn?: number;
  pressureRelativeInhg?: number;
  pressureAbsoluteInhg?: number;
  uvIndex?: number;
  solarRadiationWm2?: number;
  batteryOutdoorOk?: boolean;
  batteryIndoorOk?: boolean;
};

export type AmbientReport = {
  /** The console's MAC address, upper case with colons. */
  macAddress: string;
  /** When the console took the reading. */
  observedAt: Moment;
  readings: SampleReadings;
  /** Parameters this parser does not know; kept in the archive regardless. */
  unknown: string[];
};

export class AmbientReportError extends Error {}

/**
 * Ambient's Customized upload parameters (the ambientweather.net field
 * names), and the column each fills. Several consoles send the same reading
 * under an older name; the first present wins.
 */
const NUMBERS: [keyof SampleReadings, string[]][] = [
  ["outdoorTemperatureF", ["tempf"]],
  ["outdoorHumidityPct", ["humidity"]],
  ["indoorTemperatureF", ["tempinf"]],
  ["indoorHumidityPct", ["humidityin"]],
  ["dewPointF", ["dewPoint", "dewptf"]],
  ["feelsLikeF", ["feelsLike"]],
  ["windSpeedMph", ["windspeedmph"]],
  ["windSpeedAvg10mMph", ["windspdmph_avg10m"]],
  ["windGustMph", ["windgustmph"]],
  ["maxDailyGustMph", ["maxdailygust"]],
  ["windDirectionDeg", ["winddir"]],
  ["windDirectionAvg10mDeg", ["winddir_avg10m"]],
  // Ambient calls the rain rate "hourly rain".
  ["rainRateInHr", ["hourlyrainin"]],
  ["rainEventIn", ["eventrainin"]],
  ["rainDailyIn", ["dailyrainin"]],
  ["rainWeeklyIn", ["weeklyrainin"]],
  ["rainMonthlyIn", ["monthlyrainin"]],
  ["rainYearlyIn", ["yearlyrainin"]],
  ["pressureRelativeInhg", ["baromrelin"]],
  ["pressureAbsoluteInhg", ["baromabsin"]],
  ["uvIndex", ["uv"]],
  ["solarRadiationWm2", ["solarradiation"]],
];

/** Ambient's battery flags: 1 is OK, 0 is low. */
const FLAGS: [keyof SampleReadings, string][] = [
  ["batteryOutdoorOk", "battout"],
  ["batteryIndoorOk", "battin"],
];

/** Parameters that are known and deliberately not stored. */
const IGNORED = new Set(["PASSKEY", "stationtype", "dateutc", "freq", "model"]);

const KNOWN = new Set([
  ...IGNORED,
  ...NUMBERS.flatMap(([, names]) => names),
  ...FLAGS.map(([, name]) => name),
]);

/**
 * A console's push as a sample. The query is as Express parsed it (the
 * console sends `dateutc=2026-09-29+23:59:00`, whose `+` is a space by
 * then). `receivedAt` stands in for a console that sends `dateutc=now`.
 *
 * @throws AmbientReportError when there is no PASSKEY or no usable time.
 */
export const parseAmbientReport = (
  query: Record<string, unknown>,
  receivedAt: Moment,
): AmbientReport => {
  const text = (name: string): string | undefined => {
    const value = query[name];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === "string" && first.trim() !== ""
      ? first.trim()
      : undefined;
  };

  const macAddress = normalizeMac(text("PASSKEY"));
  if (!macAddress) throw new AmbientReportError("PASSKEY is not a MAC address");

  const observedAt = parseTime(text("dateutc"), receivedAt);
  if (!observedAt) throw new AmbientReportError("dateutc is not a time");

  const readings: SampleReadings = {};
  for (const [column, names] of NUMBERS) {
    for (const name of names) {
      const value = number(text(name));
      if (value !== undefined) {
        (readings as Record<string, number>)[column] = value;
        break;
      }
    }
  }
  for (const [column, name] of FLAGS) {
    const value = text(name);
    if (value === "1" || value === "0") {
      (readings as Record<string, boolean>)[column] = value === "1";
    }
  }

  // Derived where the console did not say: the rollups want them.
  const { outdoorTemperatureF: t, outdoorHumidityPct: rh } = readings;
  if (readings.dewPointF === undefined && t !== undefined && rh !== undefined) {
    readings.dewPointF = round(dewPointF(t, rh));
  }
  if (readings.feelsLikeF === undefined && t !== undefined) {
    readings.feelsLikeF = round(
      feelsLikeF(t, rh ?? 50, readings.windSpeedMph ?? 0),
    );
  }

  return {
    macAddress,
    observedAt,
    readings,
    unknown: Object.keys(query)
      .filter((name) => !KNOWN.has(name))
      .sort(),
  };
};

/** `a0:b1:…`, `A0-B1-…` or `a0b1c2d3e4f5` as `A0:B1:C2:D3:E4:F5`. */
export const normalizeMac = (value: string | undefined): string | undefined => {
  const hex = value?.replace(/[:.-]/g, "").toUpperCase();
  if (!hex || !/^[0-9A-F]{12}$/.test(hex)) return undefined;
  return hex.match(/../g)!.join(":");
};

const parseTime = (
  value: string | undefined,
  receivedAt: Moment,
): Moment | undefined => {
  if (value === undefined) return undefined;
  if (value.toLowerCase() === "now") return receivedAt.clone().utc();
  const parsed = moment.utc(
    value.replace("+", " "),
    ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"],
    true,
  );
  return parsed.isValid() ? parsed : undefined;
};

/** A finite number, or nothing: `-9999` is how some consoles say "no sensor". */
const number = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== -9999 ? parsed : undefined;
};

const round = (value: number) => Math.round(value * 10) / 10;
