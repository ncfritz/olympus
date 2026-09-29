import { WeatherForecast } from "@ncfritz/olympus-model";
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import moment, { type Moment } from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { toDomainObject } from "../converters/WeatherForecastConverter";
import { OpenWeatherClient } from "../providers/OpenWeatherClient";
import type { OpenWeatherSnapshot } from "../providers/openWeatherTypes";
import { ProviderError } from "../providers/ProviderError";
import { recordCacheRequest } from "../weatherMetrics";
import { WeatherLocationService } from "./WeatherLocationService";

type Entry = { snapshot: OpenWeatherSnapshot; fetchedAt: Moment };

/** How often one failing key is logged at warn; the rest go to debug. */
const LOG_EVERY_MS = 10 * 60 * 1000;

/**
 * Forecasts for a user's locations, cached in memory (ADR 0024).
 *
 * The cache is keyed by the coordinate rounded to two decimal places (about
 * a kilometre), so users who keep the same place share one fetch. A fresh
 * entry is served as it is; an expired one is refetched, concurrent misses
 * for a key sharing one fetch; when the fetch fails the old entry is served
 * marked stale until it is older than the maximum stale age, and then the
 * answer is 503. One API instance, so memory is the whole cache: a restart
 * costs one fetch per location.
 */
@Injectable()
export class WeatherForecastService {
  private readonly logger = new Logger(WeatherForecastService.name);
  private readonly entries = new Map<string, Entry>();
  private readonly inFlight = new Map<string, Promise<Entry>>();
  private readonly lastLogged = new Map<string, number>();

  constructor(
    private readonly weatherLocations: WeatherLocationService,
    private readonly openWeather: OpenWeatherClient,
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  /** The forecast for one of the user's locations. */
  async describe(userId: string, locationId: string): Promise<WeatherForecast> {
    // First: another user's location is a 404 before anything is fetched.
    const location = await this.weatherLocations.describe(userId, locationId);
    if (!this.openWeather.configured) {
      recordCacheRequest("forecast", "error");
      throw new ServiceUnavailableException(
        "Forecasts are not configured on this server",
      );
    }

    const key = cacheKey(location.latitude, location.longitude);
    const now = moment();
    const cached = this.entries.get(key);
    if (cached && ageSeconds(cached, now) < this.weather.forecast.ttlSeconds) {
      recordCacheRequest("forecast", "hit");
      return this.shape(cached, locationId, false, now);
    }

    try {
      const entry = await this.fetch(
        key,
        location.latitude,
        location.longitude,
      );
      recordCacheRequest("forecast", "miss");
      return this.shape(entry, locationId, false, now);
    } catch (error) {
      this.logFailure(key, error);
      if (
        cached &&
        ageSeconds(cached, now) < this.weather.forecast.maxStaleSeconds
      ) {
        recordCacheRequest("forecast", "stale");
        return this.shape(cached, locationId, true, now);
      }
      recordCacheRequest("forecast", "error");
      throw new ServiceUnavailableException(
        "The weather provider is not answering and there is no recent forecast to show",
      );
    }
  }

  /** One fetch per key at a time; everyone waiting shares its result. */
  private fetch(key: string, latitude: number, longitude: number) {
    const running = this.inFlight.get(key);
    if (running) return running;
    const fetching = this.openWeather
      .snapshot(roundDegrees(latitude), roundDegrees(longitude))
      .then((snapshot) => {
        const entry = { snapshot, fetchedAt: moment() };
        this.entries.set(key, entry);
        this.prune();
        return entry;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, fetching);
    return fetching;
  }

  private shape(
    entry: Entry,
    locationId: string,
    stale: boolean,
    now: Moment,
  ): WeatherForecast {
    return toDomainObject(entry.snapshot, {
      locationId,
      fetchedAt: entry.fetchedAt,
      stale,
      now,
    });
  }

  /** Drops entries too old to serve even as stale. */
  private prune() {
    const now = moment();
    for (const [key, entry] of this.entries) {
      if (ageSeconds(entry, now) >= this.weather.forecast.maxStaleSeconds) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * A failing provider is logged once per key every ten minutes at warn, so
   * an outage is visible without a line per page view. Never the error's
   * request: a ProviderError carries no URL, so no key.
   */
  private logFailure(key: string, error: unknown) {
    const message =
      error instanceof ProviderError
        ? error.message
        : `unexpected ${error instanceof Error ? error.name : "error"}`;
    const last = this.lastLogged.get(key) ?? 0;
    if (Date.now() - last >= LOG_EVERY_MS) {
      this.lastLogged.set(key, Date.now());
      this.logger.warn(`Forecast fetch failed for ${key}: ${message}`);
    } else {
      this.logger.debug(`Forecast fetch failed for ${key}: ${message}`);
    }
  }
}

const roundDegrees = (value: number) => Math.round(value * 100) / 100;

export const cacheKey = (latitude: number, longitude: number) =>
  `${roundDegrees(latitude).toFixed(2)},${roundDegrees(longitude).toFixed(2)}`;

const ageSeconds = (entry: Entry, now: Moment) =>
  now.diff(entry.fetchedAt, "seconds", true);
