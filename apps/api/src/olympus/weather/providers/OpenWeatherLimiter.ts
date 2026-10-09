import { Injectable } from "@nestjs/common";
import { TokenBucket } from "./TokenBucket";

/**
 * OpenWeather's free plan allows 60 calls a minute, shared by forecasts and
 * map tiles. The bucket stays under it, and tiles may not dip into the last
 * few calls, so a busy map never starves a forecast.
 */
@Injectable()
export class OpenWeatherLimiter {
  static readonly PER_MINUTE = 55;
  static readonly FORECAST_RESERVE = 10;

  private readonly bucket = new TokenBucket(
    OpenWeatherLimiter.PER_MINUTE,
    60_000,
  );

  /** A forecast is two calls, current and 5 day / 3 hour. */
  takeForForecast(): boolean {
    return this.bucket.tryTake(2);
  }

  takeForTile(): boolean {
    return this.bucket.tryTake(1, OpenWeatherLimiter.FORECAST_RESERVE);
  }
}
