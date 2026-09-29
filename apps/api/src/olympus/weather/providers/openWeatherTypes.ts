/**
 * OpenWeather's free-plan responses (units=imperial), as far as the API
 * reads them. https://openweathermap.org/current,
 * https://openweathermap.org/forecast5
 */

export type OpenWeatherCondition = {
  /** The condition id: 2xx thunderstorm … 800 clear, 80x clouds. */
  id: number;
  main: string;
  description: string;
  /** e.g. "10d": the suffix says day or night. */
  icon: string;
};

export type OpenWeatherCurrent = {
  dt: number;
  timezone: number;
  weather: OpenWeatherCondition[];
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  /** Metres; at most 10,000. */
  visibility?: number;
  wind: { speed: number; deg: number; gust?: number };
  clouds: { all: number };
  sys: { sunrise: number; sunset: number };
};

export type OpenWeatherForecastEntry = {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number };
  weather: OpenWeatherCondition[];
  wind: { speed: number };
  /** The probability of precipitation, 0–1. */
  pop?: number;
  /** Millimetres over the three hours. */
  rain?: { "3h"?: number };
  snow?: { "3h"?: number };
  sys?: { pod?: "d" | "n" };
};

export type OpenWeatherForecast = {
  list: OpenWeatherForecastEntry[];
  city: { timezone: number; sunrise: number; sunset: number };
};

/** Both halves of a forecast, as fetched together and cached together. */
export type OpenWeatherSnapshot = {
  current: OpenWeatherCurrent;
  forecast: OpenWeatherForecast;
};
