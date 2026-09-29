import { ExecuteWithMetrics } from "@ncfritz/olympus-nest";
import { Inject, Injectable } from "@nestjs/common";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { ProviderError } from "./ProviderError";
import type {
  OpenWeatherCurrent,
  OpenWeatherForecast,
  OpenWeatherSnapshot,
} from "./openWeatherTypes";

const TARGET = { server: "openweather", api: "openweather" };

/**
 * OpenWeather's free plan: current weather and the 5 day / 3 hour forecast
 * (ADR 0024). The key travels as the `appid` query parameter, so nothing
 * here ever logs a URL or passes an axios error on: failures become a
 * `ProviderError` that carries only a status and a reason.
 */
@Injectable()
export class OpenWeatherClient {
  private readonly http: AxiosInstance;

  constructor(
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {
    this.http = axios.create({
      baseURL: "https://api.openweathermap.org/data/2.5",
      timeout: weather.providerTimeoutMs,
    });
  }

  get configured(): boolean {
    return Boolean(this.weather.openWeatherApiKey);
  }

  /** Current weather and the forecast for a coordinate, fetched together. */
  async snapshot(
    latitude: number,
    longitude: number,
  ): Promise<OpenWeatherSnapshot> {
    if (!this.configured) {
      throw new ProviderError("openweather", "not_configured");
    }
    const [current, forecast] = await Promise.all([
      this.call(() => this.fetchCurrent(latitude, longitude)),
      this.call(() => this.fetchForecast(latitude, longitude)),
    ]);
    return { current, forecast };
  }

  @ExecuteWithMetrics("Weather.Current", TARGET)
  private fetchCurrent(
    lat: number,
    lon: number,
  ): Promise<AxiosResponse<OpenWeatherCurrent>> {
    return this.http.get("/weather", { params: this.params(lat, lon) });
  }

  @ExecuteWithMetrics("Forecast.FiveDay", TARGET)
  private fetchForecast(
    lat: number,
    lon: number,
  ): Promise<AxiosResponse<OpenWeatherForecast>> {
    return this.http.get("/forecast", { params: this.params(lat, lon) });
  }

  private params(lat: number, lon: number) {
    return {
      lat,
      lon,
      units: "imperial",
      appid: this.weather.openWeatherApiKey,
    };
  }

  /** Runs one call, turning every failure into a ProviderError. */
  private async call<T>(
    fetch: () => Promise<AxiosResponse<T> | undefined>,
  ): Promise<T> {
    let response: AxiosResponse<T> | undefined;
    try {
      response = await fetch();
    } catch (error) {
      throw ProviderError.from("openweather", error);
    }
    // ExecuteWithMetrics answers a 404 with undefined.
    if (!response) throw new ProviderError("openweather", "not_found", 404);
    return response.data;
  }
}
