import moment, { type Moment } from "moment";
import type {
  OpenWeatherCurrent,
  OpenWeatherForecastEntry,
} from "../providers/openWeatherTypes";

/**
 * Forecast history (migration 1790750000000): what a forecast said about
 * each 3-hour step, and the temperatures observed, kept so that today is
 * built from its passed hours too. The rows hold what a day needs and no
 * more; read back, a step is an OpenWeather forecast entry again, so the
 * forecast converter treats it like any other.
 */

/** A step as Hasura returns it (custom column names). */
export type GraphQlWeatherForecastStep = {
  stepTime: string;
  temperatureF: number;
  precipitationChance: number;
  precipitationMm: number;
  conditionId: number;
  conditionMain: string;
  conditionDescription: string;
  conditionIcon: string;
};

export type GraphQlWeatherObservedTemperature = {
  observedTime: string;
  temperatureF: number;
};

/** What the history knows of a place since a time. */
export type ForecastHistory = {
  /** The last forecast of each step, oldest first. */
  steps: OpenWeatherForecastEntry[];
  /** The temperatures observed. */
  temperaturesF: number[];
};

/** A place: the forecast cache's coordinate, to two decimal places. */
export type Place = { latitude: number; longitude: number };

/** A forecast step as a row, for its place, as fetched at `fetchedAt`. */
export const toStepRow = (
  place: Place,
  entry: OpenWeatherForecastEntry,
  fetchedAt: Moment,
) => {
  const condition = entry.weather[0];
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    stepTime: moment.unix(entry.dt).utc().toISOString(),
    temperatureF: entry.main.temp,
    precipitationChance: Math.min(1, Math.max(0, entry.pop ?? 0)),
    precipitationMm: (entry.rain?.["3h"] ?? 0) + (entry.snow?.["3h"] ?? 0),
    conditionId: condition?.id ?? 800,
    conditionMain: condition?.main ?? "Clear",
    conditionDescription: condition?.description ?? "",
    conditionIcon: condition?.icon ?? "01d",
    fetchedTime: fetchedAt.clone().utc().toISOString(),
  };
};

/** The current reading's temperature as a row, for its place. */
export const toObservedRow = (place: Place, current: OpenWeatherCurrent) => ({
  latitude: place.latitude,
  longitude: place.longitude,
  observedTime: moment.unix(current.dt).utc().toISOString(),
  temperatureF: current.main.temp,
});

/**
 * A stored step as an OpenWeather forecast entry. The fields a day does
 * not use (feels like, humidity, pressure, wind) are not kept: they are
 * the temperature and zeros, and nothing reads them.
 */
export const toForecastEntry = (
  row: GraphQlWeatherForecastStep,
): OpenWeatherForecastEntry => ({
  dt: moment(row.stepTime).unix(),
  main: {
    temp: row.temperatureF,
    feels_like: row.temperatureF,
    temp_min: row.temperatureF,
    temp_max: row.temperatureF,
    pressure: 0,
    humidity: 0,
  },
  weather: [
    {
      id: row.conditionId,
      main: row.conditionMain,
      description: row.conditionDescription,
      icon: row.conditionIcon,
    },
  ],
  wind: { speed: 0 },
  pop: row.precipitationChance,
  rain: row.precipitationMm > 0 ? { "3h": row.precipitationMm } : undefined,
});
