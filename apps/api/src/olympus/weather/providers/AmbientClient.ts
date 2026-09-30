import { ExecuteWithMetrics } from "@ncfritz/olympus-nest";
import { Inject, Injectable } from "@nestjs/common";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import type { Moment } from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import type { AmbientRecord } from "./ambientTypes";
import { ProviderError } from "./ProviderError";

const TARGET = { server: "ambientweather", api: "ambientweather" };

/** Ambient allows one request a second per key pair; a little under. */
export const AMBIENT_REQUEST_GAP_MS = 1_100;
/** The most records one request returns: a day at 5-minute steps. */
export const AMBIENT_PAGE = 288;

/**
 * ambientweather.net's REST API, for backfill (ADR 0024, plan phase 7):
 * a station's history at 5-minute steps, newest first, up to 288 records
 * ending at `endDate`.
 *
 * Both keys travel as query parameters, so, as with OpenWeather, nothing
 * here logs a URL or passes an axios error on, and nothing archives a
 * request: failures become a ProviderError with a status and a reason.
 * Requests are spaced at least AMBIENT_REQUEST_GAP_MS apart, one at a time.
 */
@Injectable()
export class AmbientClient {
  private readonly http: AxiosInstance;
  private queue: Promise<unknown> = Promise.resolve();
  private lastAt = 0;

  constructor(
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {
    this.http = axios.create({
      baseURL: "https://rt.ambientweather.net/v1",
      timeout: weather.providerTimeoutMs,
    });
  }

  get configured(): boolean {
    return Boolean(this.weather.ambient);
  }

  /** Up to 288 records for a console, newest first, none after `endDate`. */
  deviceData(macAddress: string, endDate: Moment): Promise<AmbientRecord[]> {
    const run = this.queue.then(() => this.spaced(macAddress, endDate));
    // The next request waits for this one, whether it worked or not.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async spaced(
    macAddress: string,
    endDate: Moment,
  ): Promise<AmbientRecord[]> {
    const keys = this.weather.ambient;
    if (!keys) throw new ProviderError("ambientweather", "not_configured");
    const wait = this.lastAt + AMBIENT_REQUEST_GAP_MS - Date.now();
    if (wait > 0) await this.pause(wait);
    this.lastAt = Date.now();

    let response: AxiosResponse<AmbientRecord[]> | undefined;
    try {
      response = await this.fetchDevice(
        macAddress,
        endDate.valueOf(),
        keys.applicationKey,
        keys.apiKey,
      );
    } catch (error) {
      throw ProviderError.from("ambientweather", error);
    }
    // ExecuteWithMetrics answers a 404 with undefined.
    if (!response) throw new ProviderError("ambientweather", "not_found", 404);
    if (!Array.isArray(response.data)) {
      throw new ProviderError("ambientweather", "unavailable");
    }
    return response.data;
  }

  @ExecuteWithMetrics("Device.Data", TARGET)
  private fetchDevice(
    macAddress: string,
    endDate: number,
    applicationKey: string,
    apiKey: string,
  ): Promise<AxiosResponse<AmbientRecord[]>> {
    return this.http.get(`/devices/${encodeURIComponent(macAddress)}`, {
      params: { applicationKey, apiKey, endDate, limit: AMBIENT_PAGE },
    });
  }

  /** The wait between requests; replaced in the tests. */
  protected pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
