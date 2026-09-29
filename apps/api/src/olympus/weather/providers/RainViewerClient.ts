import { ExecuteWithMetrics } from "@ncfritz/olympus-nest";
import { Inject, Injectable } from "@nestjs/common";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { ProviderError } from "./ProviderError";
import type { RainViewerFrame, RainViewerMaps } from "./rainViewerTypes";
import { TokenBucket } from "./TokenBucket";

const TARGET = { server: "rainviewer", api: "rainviewer" };

/** The only colour scheme RainViewer still serves free: Universal Blue. */
const COLOR_SCHEME = 2;
/** Smoothed, with snow shown in its own colours. */
const OPTIONS = "1_1";
export const RADAR_MAX_ZOOM = 7;

/**
 * RainViewer's free Weather Maps API: the list of past radar frames and
 * their tiles (ADR 0024). Personal use, zoom 7 at most, 100 requests per IP
 * a minute; the bucket keeps this server under that.
 */
@Injectable()
export class RainViewerClient {
  static readonly PER_MINUTE = 90;

  private readonly http: AxiosInstance;
  private readonly bucket = new TokenBucket(
    RainViewerClient.PER_MINUTE,
    60_000,
  );

  constructor(@Inject(weatherConfig.KEY) weather: WeatherConfigType) {
    this.http = axios.create({ timeout: weather.providerTimeoutMs });
  }

  async maps(): Promise<RainViewerMaps> {
    this.take();
    return this.call(() => this.fetchMaps());
  }

  /** One radar tile of a frame, as PNG bytes. */
  async tile(
    host: string,
    frame: RainViewerFrame,
    z: number,
    x: number,
    y: number,
  ): Promise<Buffer> {
    this.take();
    const url = `${host}${frame.path}/256/${z}/${x}/${y}/${COLOR_SCHEME}/${OPTIONS}.png`;
    return Buffer.from(await this.call(() => this.fetchTile(url)));
  }

  @ExecuteWithMetrics("Maps.Index", TARGET)
  private fetchMaps(): Promise<AxiosResponse<RainViewerMaps>> {
    return this.http.get("https://api.rainviewer.com/public/weather-maps.json");
  }

  @ExecuteWithMetrics("Radar.Tile", TARGET)
  private fetchTile(url: string): Promise<AxiosResponse<ArrayBuffer>> {
    return this.http.get(url, { responseType: "arraybuffer" });
  }

  private take() {
    if (!this.bucket.tryTake()) {
      throw new ProviderError("rainviewer", "rate_limited");
    }
  }

  private async call<T>(
    fetch: () => Promise<AxiosResponse<T> | undefined>,
  ): Promise<T> {
    let response: AxiosResponse<T> | undefined;
    try {
      response = await fetch();
    } catch (error) {
      throw ProviderError.from("rainviewer", error);
    }
    if (!response) throw new ProviderError("rainviewer", "not_found", 404);
    return response.data;
  }
}
