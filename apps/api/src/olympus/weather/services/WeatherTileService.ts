import { RadarFrame, WeatherMapLayer } from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { LRUCache } from "lru-cache";
import moment from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { OpenWeatherClient } from "../providers/OpenWeatherClient";
import { ProviderError } from "../providers/ProviderError";
import {
  RADAR_MAX_ZOOM,
  RainViewerClient,
} from "../providers/RainViewerClient";
import type { RainViewerMaps } from "../providers/rainViewerTypes";
import { type CacheResult, recordCacheRequest } from "../weatherMetrics";

/** A tile as PNG bytes and how long a browser may keep it. */
export type WeatherTile = { png: Buffer; maxAgeSeconds: number };

/** The widget sits at zoom 8; a little either side is allowed. */
export const LAYER_MAX_ZOOM = 10;
/** How long the radar frame list is used before it is fetched again. */
const FRAMES_TTL_MS = 5 * 60 * 1000;
/** How long an old frame list is served while RainViewer is failing. */
const FRAMES_MAX_STALE_MS = 30 * 60 * 1000;
/** A frame stays listed for two hours; its tiles live that long, and a little more. */
const FRAME_LIFETIME_S = 2 * 60 * 60 + 10 * 60;
const MIN_MAX_AGE_S = 60;
const LOG_EVERY_MS = 10 * 60 * 1000;

/**
 * Map layer and radar tiles through the API (ADR 0024), so no provider key
 * reaches the browser and tile traffic is bounded by distinct tiles rather
 * than page views.
 *
 * One cache for both providers, bounded by bytes (`WEATHER_TILE_CACHE_MB`),
 * least recently used first. Layer tiles live `WEATHER_TILE_TTL_SECONDS`;
 * radar tiles live as long as their frame is listed. Concurrent misses for
 * one tile share a fetch. A tile the provider will not give (rate limit,
 * outage, no key) is a 503, and the widget draws the base map without it.
 */
@Injectable()
export class WeatherTileService {
  private readonly logger = new Logger(WeatherTileService.name);
  private readonly tiles: LRUCache<string, Buffer>;
  private readonly inFlight = new Map<string, Promise<Buffer>>();
  private frames?: { maps: RainViewerMaps; fetchedAt: number };
  private framesInFlight?: Promise<RainViewerMaps>;
  private readonly lastLogged = new Map<string, number>();

  constructor(
    private readonly openWeather: OpenWeatherClient,
    private readonly rainViewer: RainViewerClient,
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {
    this.tiles = new LRUCache<string, Buffer>({
      maxSize: weather.tiles.cacheMb * 1024 * 1024,
      sizeCalculation: (png) => Math.max(png.length, 1),
    });
  }

  /** A forecast layer's tile from OpenWeather. */
  async layerTile(
    layer: string,
    z: number,
    x: number,
    y: number,
  ): Promise<WeatherTile> {
    if (!isLayer(layer)) {
      throw new BadRequestException(
        `layer must be one of ${Object.values(WeatherMapLayer).join(", ")}`,
      );
    }
    checkTile(z, x, y, LAYER_MAX_ZOOM);
    return this.cached(
      "openweather",
      `openweather/${layer}/${z}/${x}/${y}`,
      this.weather.tiles.ttlSeconds,
      () => this.openWeather.tile(layer, z, x, y),
    );
  }

  /** The past radar frames, oldest first. */
  async radarFrames(): Promise<RadarFrame[]> {
    const maps = await this.maps();
    return maps.radar.past
      .map((frame) => ({
        id: String(frame.time),
        time: moment.unix(frame.time).utc(),
      }))
      .sort((a, b) => a.time.valueOf() - b.time.valueOf());
  }

  /**
   * A radar tile for a listed frame. RainViewer stops at zoom 7; the site
   * scales those tiles up rather than asking for finer ones.
   */
  async radarTile(
    frameId: string,
    z: number,
    x: number,
    y: number,
  ): Promise<WeatherTile> {
    checkTile(z, x, y, RADAR_MAX_ZOOM);
    const maps = await this.maps();
    const frame = maps.radar.past.find(
      (candidate) => String(candidate.time) === frameId,
    );
    if (!frame) {
      throw new NotFoundException(`Radar frame with id ${frameId} not found`);
    }
    const lifetime = Math.max(
      frame.time + FRAME_LIFETIME_S - moment().unix(),
      MIN_MAX_AGE_S,
    );
    return this.cached(
      "rainviewer",
      `rainviewer/${frame.time}/${z}/${x}/${y}`,
      lifetime,
      () => this.rainViewer.tile(maps.host, frame, z, x, y),
    );
  }

  private async cached(
    provider: string,
    key: string,
    ttlSeconds: number,
    fetch: () => Promise<Buffer>,
  ): Promise<WeatherTile> {
    const cache = `tile-${provider}`;
    const hit = this.tiles.get(key);
    if (hit) {
      record(cache, "hit");
      return {
        png: hit,
        maxAgeSeconds: Math.max(
          Math.floor(this.tiles.getRemainingTTL(key) / 1000),
          0,
        ),
      };
    }

    let running = this.inFlight.get(key);
    if (!running) {
      running = fetch()
        .then((png) => {
          this.tiles.set(key, png, { ttl: ttlSeconds * 1000 });
          return png;
        })
        .finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, running);
    }

    try {
      const png = await running;
      record(cache, "miss");
      return { png, maxAgeSeconds: ttlSeconds };
    } catch (error) {
      record(cache, "error");
      throw this.failure(provider, error);
    }
  }

  /** The frame list, refreshed every five minutes, old one kept on failure. */
  private async maps(): Promise<RainViewerMaps> {
    const now = Date.now();
    if (this.frames && now - this.frames.fetchedAt < FRAMES_TTL_MS) {
      record("radar-frames", "hit");
      return this.frames.maps;
    }
    try {
      this.framesInFlight ??= this.rainViewer.maps().finally(() => {
        this.framesInFlight = undefined;
      });
      const maps = await this.framesInFlight;
      this.frames = { maps, fetchedAt: Date.now() };
      record("radar-frames", "miss");
      return maps;
    } catch (error) {
      if (this.frames && now - this.frames.fetchedAt < FRAMES_MAX_STALE_MS) {
        this.log("rainviewer", error);
        record("radar-frames", "stale");
        return this.frames.maps;
      }
      record("radar-frames", "error");
      throw this.failure("rainviewer", error);
    }
  }

  private failure(provider: string, error: unknown): Error {
    if (error instanceof ProviderError && error.reason === "not_found") {
      return new NotFoundException("The provider has no such tile");
    }
    this.log(provider, error);
    return new ServiceUnavailableException(
      error instanceof ProviderError && error.reason === "not_configured"
        ? "Map layers are not configured on this server"
        : "The map provider is not answering",
    );
  }

  /** Once per provider every ten minutes at warn; never a URL. */
  private log(provider: string, error: unknown) {
    const message =
      error instanceof ProviderError
        ? error.message
        : `${provider}: unexpected ${error instanceof Error ? error.name : "error"}`;
    const last = this.lastLogged.get(provider) ?? 0;
    if (Date.now() - last >= LOG_EVERY_MS) {
      this.lastLogged.set(provider, Date.now());
      this.logger.warn(`Tile fetch failed: ${message}`);
    } else {
      this.logger.debug(`Tile fetch failed: ${message}`);
    }
  }
}

const isLayer = (value: string): value is WeatherMapLayer =>
  (Object.values(WeatherMapLayer) as string[]).includes(value);

/** A tile that exists at its zoom: 0 ≤ x, y < 2^z. */
const checkTile = (z: number, x: number, y: number, maxZoom: number) => {
  if (!Number.isInteger(z) || z < 0 || z > maxZoom) {
    throw new BadRequestException(`z must be from 0 to ${maxZoom}`);
  }
  const span = 2 ** z;
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= span ||
    y >= span
  ) {
    throw new BadRequestException(
      `x and y must be from 0 to ${span - 1} at zoom ${z}`,
    );
  }
};

const record = (cache: string, result: CacheResult) =>
  recordCacheRequest(cache, result);
