import {
  CurrentWeather,
  ForecastDay,
  ForecastStep,
  WeatherConditionKind,
  WeatherForecast,
} from "@ncfritz/olympus-model";
import moment, { type Moment } from "moment";
import type {
  OpenWeatherCondition,
  OpenWeatherForecastEntry,
  OpenWeatherSnapshot,
} from "../providers/openWeatherTypes";

const STEP_SECONDS = 3 * 60 * 60;
const NEXT_STEPS = 8;
const DAYS = 5;
const MM_PER_INCH = 25.4;
const IN_HG_PER_HPA = 0.0295299830714;
const MILES_PER_METRE = 1 / 1609.344;
/** A step at least this likely to be wet decides its day's condition. */
const WET_ENOUGH = 0.5;

/** Most significant first: the order a day's condition is chosen in. */
const SIGNIFICANCE: WeatherConditionKind[] = [
  WeatherConditionKind.Thunderstorm,
  WeatherConditionKind.Snow,
  WeatherConditionKind.Rain,
  WeatherConditionKind.Drizzle,
  WeatherConditionKind.Fog,
  WeatherConditionKind.Cloudy,
  WeatherConditionKind.PartlyCloudy,
  WeatherConditionKind.Clear,
];

const WET = new Set([
  WeatherConditionKind.Thunderstorm,
  WeatherConditionKind.Snow,
  WeatherConditionKind.Rain,
  WeatherConditionKind.Drizzle,
]);

export type ForecastContext = {
  locationId: string;
  fetchedAt: Moment;
  stale: boolean;
  /** When the forecast is read: which steps are "next" and which day is today. */
  now: Moment;
};

/**
 * OpenWeather's current weather and 5 day / 3 hour forecast as the model's
 * forecast. Shaped when it is read rather than when it is fetched, so a
 * cached or stale snapshot still starts "next" and "today" at now.
 */
export const toDomainObject = (
  snapshot: OpenWeatherSnapshot,
  context: ForecastContext,
): WeatherForecast => {
  const { current, forecast } = snapshot;
  const utcOffsetSeconds = forecast.city?.timezone ?? current.timezone ?? 0;
  const localDate = (unixSeconds: number) =>
    moment
      .unix(unixSeconds)
      .utcOffset(utcOffsetSeconds / 60)
      .format("YYYY-MM-DD");

  const nowSeconds = context.now.unix();
  const steps = [...forecast.list]
    .sort((a, b) => a.dt - b.dt)
    // A step that has not yet ended still has something to say.
    .filter((entry) => entry.dt + STEP_SECONDS > nowSeconds);

  const today = localDate(nowSeconds);
  const currentCondition = primary(current.weather);
  const days = buildDays(steps, localDate, today, {
    temperatureF: current.main.temp,
    condition: currentCondition,
  });
  const todayDay = days[0];

  return {
    locationId: context.locationId,
    utcOffsetSeconds,
    current: {
      observedTime: moment.unix(current.dt).utc(),
      conditionKind: kindOf(currentCondition.id),
      condition: currentCondition.description,
      isDaytime: isDaytime(currentCondition.icon),
      temperatureF: round(current.main.temp, 1),
      feelsLikeF: round(current.main.feels_like, 1),
      highF: todayDay.highF,
      lowF: todayDay.lowF,
      humidityPct: current.main.humidity,
      dewPointF: round(dewPointF(current.main.temp, current.main.humidity), 1),
      pressureHpa: current.main.pressure,
      pressureInHg: round(current.main.pressure * IN_HG_PER_HPA, 2),
      windSpeedMph: round(current.wind.speed, 1),
      windGustMph:
        current.wind.gust === undefined
          ? undefined
          : round(current.wind.gust, 1),
      windDirectionDeg: current.wind.deg,
      visibilityMi:
        current.visibility === undefined
          ? undefined
          : round(current.visibility * MILES_PER_METRE, 1),
      cloudCoverPct: current.clouds.all,
      sunriseTime: moment.unix(current.sys.sunrise).utc(),
      sunsetTime: moment.unix(current.sys.sunset).utc(),
    } satisfies CurrentWeather,
    next: steps.slice(0, NEXT_STEPS).map(toStep),
    days,
    fetchedTime: context.fetchedAt.clone().utc(),
    stale: context.stale,
  };
};

const toStep = (entry: OpenWeatherForecastEntry): ForecastStep => {
  const condition = primary(entry.weather);
  return {
    time: moment.unix(entry.dt).utc(),
    conditionKind: kindOf(condition.id),
    condition: condition.description,
    isDaytime: entry.sys?.pod
      ? entry.sys.pod === "d"
      : isDaytime(condition.icon),
    temperatureF: round(entry.main.temp, 1),
    precipitationChancePct: Math.round((entry.pop ?? 0) * 100),
    precipitationIn: round(precipitationMm(entry) / MM_PER_INCH, 2),
    windSpeedMph: round(entry.wind.speed, 1),
  };
};

/**
 * Today and the next four local days. Today always exists: late in the
 * evening, when no step of it is left, it is built from the current
 * reading alone. Today's high and low include the current temperature.
 */
const buildDays = (
  steps: OpenWeatherForecastEntry[],
  localDate: (unixSeconds: number) => string,
  today: string,
  now: { temperatureF: number; condition: OpenWeatherCondition },
): ForecastDay[] => {
  const byDate = new Map<string, OpenWeatherForecastEntry[]>();
  byDate.set(today, []);
  for (const entry of steps) {
    const date = localDate(entry.dt);
    if (date < today) continue;
    const list = byDate.get(date) ?? [];
    list.push(entry);
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([date, entries]) => date === today || entries.length > 0)
    .slice(0, DAYS)
    .map(([date, entries]) => {
      const temperatures = entries.map((entry) => entry.main.temp);
      if (date === today) temperatures.push(now.temperatureF);
      const condition =
        entries.length > 0 ? daysCondition(entries) : now.condition;
      return {
        date,
        conditionKind: kindOf(condition.id),
        condition: condition.description,
        highF: round(Math.max(...temperatures), 1),
        lowF: round(Math.min(...temperatures), 1),
        precipitationChancePct: Math.round(
          Math.max(0, ...entries.map((entry) => entry.pop ?? 0)) * 100,
        ),
        precipitationIn: round(
          entries.reduce((sum, entry) => sum + precipitationMm(entry), 0) /
            MM_PER_INCH,
          2,
        ),
      };
    });
};

/**
 * A day's condition: the most significant wet weather that is likely
 * (at least a 50% chance in its step), otherwise the kind seen most in the
 * day's daytime steps (all steps if none is daytime), the more significant
 * winning a tie.
 */
export const daysCondition = (
  entries: OpenWeatherForecastEntry[],
): OpenWeatherCondition => {
  const likelyWet = entries
    .map((entry) => ({ entry, condition: primary(entry.weather) }))
    .filter(
      ({ entry, condition }) =>
        WET.has(kindOf(condition.id)) && (entry.pop ?? 0) >= WET_ENOUGH,
    )
    .sort(
      (a, b) =>
        significance(kindOf(a.condition.id)) -
        significance(kindOf(b.condition.id)),
    );
  if (likelyWet.length > 0) return likelyWet[0].condition;

  const daytime = entries.filter((entry) => entry.sys?.pod === "d");
  const pool = daytime.length > 0 ? daytime : entries;
  const counts = new Map<
    WeatherConditionKind,
    { count: number; first: OpenWeatherCondition }
  >();
  for (const entry of pool) {
    const condition = primary(entry.weather);
    const kind = kindOf(condition.id);
    const seen = counts.get(kind);
    counts.set(kind, {
      count: (seen?.count ?? 0) + 1,
      first: seen?.first ?? condition,
    });
  }
  return [...counts.entries()].sort(
    ([kindA, a], [kindB, b]) =>
      b.count - a.count || significance(kindA) - significance(kindB),
  )[0][1].first;
};

/** OpenWeather's condition id as the kind the site draws. */
export const kindOf = (id: number): WeatherConditionKind => {
  if (id >= 200 && id < 300) return WeatherConditionKind.Thunderstorm;
  if (id >= 300 && id < 400) return WeatherConditionKind.Drizzle;
  if (id >= 500 && id < 600) return WeatherConditionKind.Rain;
  if (id >= 600 && id < 700) return WeatherConditionKind.Snow;
  if (id >= 700 && id < 800) return WeatherConditionKind.Fog;
  if (id === 800) return WeatherConditionKind.Clear;
  if (id === 801 || id === 802) return WeatherConditionKind.PartlyCloudy;
  return WeatherConditionKind.Cloudy;
};

/** Dew point from temperature and relative humidity (Magnus, °F in and out). */
export const dewPointF = (
  temperatureF: number,
  humidityPct: number,
): number => {
  const a = 17.62;
  const b = 243.12;
  const celsius = ((temperatureF - 32) * 5) / 9;
  const gamma =
    Math.log(Math.max(humidityPct, 1) / 100) + (a * celsius) / (b + celsius);
  return ((b * gamma) / (a - gamma)) * (9 / 5) + 32;
};

const significance = (kind: WeatherConditionKind) => SIGNIFICANCE.indexOf(kind);

const primary = (conditions: OpenWeatherCondition[]): OpenWeatherCondition =>
  conditions[0] ?? { id: 804, main: "Clouds", description: "", icon: "04d" };

const isDaytime = (icon: string) => !icon.endsWith("n");

const precipitationMm = (entry: OpenWeatherForecastEntry) =>
  (entry.rain?.["3h"] ?? 0) + (entry.snow?.["3h"] ?? 0);

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};
