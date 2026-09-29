import { describe, expect, it } from "vitest";
import { OpenWeatherLimiter } from "../../../../../src/olympus/weather/providers/OpenWeatherLimiter";
import { TokenBucket } from "../../../../../src/olympus/weather/providers/TokenBucket";

describe("TokenBucket", () => {
  it("allows its capacity, then refills evenly", () => {
    let now = 0;
    const bucket = new TokenBucket(3, 60_000, () => now);
    expect([1, 2, 3, 4].map(() => bucket.tryTake())).toEqual([
      true,
      true,
      true,
      false,
    ]);
    now = 20_000; // a third of the minute: one token back
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(false);
  });

  it("never holds more than its capacity", () => {
    let now = 0;
    const bucket = new TokenBucket(2, 60_000, () => now);
    now = 10 * 60_000;
    expect(bucket.tryTake(3)).toBe(false);
    expect(bucket.tryTake(2)).toBe(true);
  });

  it("leaves a reserve untouched", () => {
    const bucket = new TokenBucket(5, 60_000, () => 0);
    expect(bucket.tryTake(1, 3)).toBe(true);
    expect(bucket.tryTake(1, 3)).toBe(true);
    expect(bucket.tryTake(1, 3)).toBe(false);
    expect(bucket.tryTake(3)).toBe(true);
  });
});

describe("OpenWeatherLimiter", () => {
  it("stops tiles short of the forecasts' reserve", () => {
    const limiter = new OpenWeatherLimiter();
    let tiles = 0;
    while (limiter.takeForTile()) tiles += 1;
    expect(tiles).toBe(
      OpenWeatherLimiter.PER_MINUTE - OpenWeatherLimiter.FORECAST_RESERVE,
    );
    // Forecasts still get through.
    expect(limiter.takeForForecast()).toBe(true);
  });
});
