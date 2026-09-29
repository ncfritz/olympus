/**
 * OpenWeather free-plan responses (units=imperial), shaped like the real
 * ones for Mill Creek, WA on 2026-09-29, when the offset was UTC-7.
 */
import type {
  OpenWeatherCondition,
  OpenWeatherCurrent,
  OpenWeatherForecast,
  OpenWeatherForecastEntry,
  OpenWeatherSnapshot,
} from "../../src/olympus/weather/providers/openWeatherTypes";

/** 2026-09-29T19:50:00Z, 12:50 PM in Mill Creek. */
export const OBSERVED = 1_790_711_400;
/** The forecast's first step: 2026-09-29T21:00:00Z, 2 PM local. */
export const FIRST_STEP = 1_790_715_600;
export const PACIFIC_DAYLIGHT = -25_200;

export const condition = (
  id: number,
  description: string,
  icon: string,
): OpenWeatherCondition => ({ id, main: "", description, icon });

export const LIGHT_RAIN = condition(500, "light rain", "10d");
export const MODERATE_RAIN = condition(501, "moderate rain", "10d");
export const THUNDER = condition(211, "thunderstorm", "11d");
export const OVERCAST = condition(804, "overcast clouds", "04d");
export const BROKEN = condition(803, "broken clouds", "04d");
export const SCATTERED = condition(802, "scattered clouds", "03d");
export const CLEAR = condition(800, "clear sky", "01d");
export const CLEAR_NIGHT = condition(800, "clear sky", "01n");

export const openWeatherCurrent = (
  overrides: Partial<OpenWeatherCurrent> = {},
): OpenWeatherCurrent => ({
  dt: OBSERVED,
  timezone: PACIFIC_DAYLIGHT,
  weather: [LIGHT_RAIN],
  main: {
    temp: 58.1,
    feels_like: 55.4,
    temp_min: 56.2,
    temp_max: 59.9,
    pressure: 1014,
    humidity: 87,
  },
  visibility: 9656,
  wind: { speed: 9.2, deg: 202, gust: 16.1 },
  clouds: { all: 90 },
  sys: { sunrise: 1_790_690_640, sunset: 1_790_733_120 },
  ...overrides,
});

export const step = (
  dt: number,
  temp: number,
  weather: OpenWeatherCondition = OVERCAST,
  extra: Partial<OpenWeatherForecastEntry> = {},
): OpenWeatherForecastEntry => ({
  dt,
  main: { temp, temp_min: temp, temp_max: temp },
  weather: [weather],
  wind: { speed: 6.5 },
  pop: 0,
  sys: { pod: weather.icon.endsWith("n") ? "n" : "d" },
  ...extra,
});

/**
 * Forty 3-hour steps from `start`, temperatures following a daily curve,
 * overcast unless a step is given explicitly.
 */
export const openWeatherForecast = (
  overrides: Partial<OpenWeatherForecast> = {},
  start = FIRST_STEP,
): OpenWeatherForecast => ({
  list: Array.from({ length: 40 }, (_, i) =>
    step(
      start + i * 10_800,
      Math.round((54 + 6 * Math.sin((i / 8) * 2 * Math.PI)) * 10) / 10,
    ),
  ),
  city: {
    timezone: PACIFIC_DAYLIGHT,
    sunrise: 1_790_690_640,
    sunset: 1_790_733_120,
  },
  ...overrides,
});

export const openWeatherSnapshot = (
  overrides: Partial<OpenWeatherSnapshot> = {},
): OpenWeatherSnapshot => ({
  current: openWeatherCurrent(),
  forecast: openWeatherForecast(),
  ...overrides,
});
