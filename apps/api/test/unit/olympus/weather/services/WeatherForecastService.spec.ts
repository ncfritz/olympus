import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import { ProviderError } from "../../../../../src/olympus/weather/providers/ProviderError";
import {
  cacheKey,
  WeatherForecastService,
} from "../../../../../src/olympus/weather/services/WeatherForecastService";
import { openWeatherSnapshot, step } from "../../../../fixtures/openWeather";

const USER = "user-1";

const location = (id: string, latitude: number, longitude: number) => ({
  id,
  label: id,
  latitude,
  longitude,
  position: 0,
  isDefault: true,
  createdTime: undefined as never,
});

const config = {
  forecast: { ttlSeconds: 900, maxStaleSeconds: 21_600 },
} as WeatherConfigType;

describe("WeatherForecastService", () => {
  let snapshot: ReturnType<typeof vi.fn>;
  let describeLocation: ReturnType<typeof vi.fn>;
  let service: WeatherForecastService;
  let client: { configured: boolean; snapshot: ReturnType<typeof vi.fn> };
  let history: {
    record: ReturnType<typeof vi.fn>;
    since: ReturnType<typeof vi.fn>;
    prune: ReturnType<typeof vi.fn>;
  };

  const at = (iso: string) => vi.setSystemTime(new Date(iso));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-09-29T20:00:00Z");
    snapshot = vi.fn().mockResolvedValue(openWeatherSnapshot());
    describeLocation = vi.fn(async (_user: string, id: string) =>
      id === "far"
        ? location("far", 51.383618, -2.373979)
        : location(id, 47.8525684, -122.238287),
    );
    client = { configured: true, snapshot };
    history = {
      record: vi.fn().mockResolvedValue(undefined),
      since: vi.fn().mockResolvedValue({ steps: [], temperaturesF: [] }),
      prune: vi.fn().mockResolvedValue(undefined),
    };
    service = new WeatherForecastService(
      { describe: describeLocation } as never,
      client as never,
      history as never,
      config,
    );
  });

  afterEach(() => vi.useRealTimers());

  it("fetches once, then serves from the cache within the TTL", async () => {
    await service.describe(USER, "home");
    at("2026-09-29T20:14:00Z");
    const second = await service.describe(USER, "home");
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(second.stale).toBe(false);
    expect(second.fetchedTime.toISOString()).toBe("2026-09-29T20:00:00.000Z");
  });

  it("refetches once the TTL has passed", async () => {
    await service.describe(USER, "home");
    at("2026-09-29T20:15:01Z");
    await service.describe(USER, "home");
    expect(snapshot).toHaveBeenCalledTimes(2);
  });

  it("shares one fetch between locations within about a kilometre", async () => {
    describeLocation.mockImplementation(async (_u: string, id: string) =>
      id === "a"
        ? location("a", 47.8525684, -122.238287)
        : location("b", 47.8531, -122.2411),
    );
    await service.describe(USER, "a");
    const other = await service.describe(USER, "b");
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(other.locationId).toBe("b");
    expect(snapshot).toHaveBeenCalledWith(47.85, -122.24);
  });

  it("fetches separately for a different place", async () => {
    await service.describe(USER, "home");
    await service.describe(USER, "far");
    expect(snapshot).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent misses into one fetch", async () => {
    let release: (value: unknown) => void = () => {};
    snapshot.mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve(openWeatherSnapshot());
      }),
    );
    const both = Promise.all([
      service.describe(USER, "home"),
      service.describe(USER, "home"),
    ]);
    await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(1));
    release(undefined);
    const [a, b] = await both;
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(a.fetchedTime.isSame(b.fetchedTime)).toBe(true);
  });

  it("serves the last forecast, marked stale, while the provider fails", async () => {
    await service.describe(USER, "home");
    at("2026-09-29T22:00:00Z");
    snapshot.mockRejectedValue(new ProviderError("openweather", "timeout"));
    const stale = await service.describe(USER, "home");
    expect(stale.stale).toBe(true);
    expect(stale.fetchedTime.toISOString()).toBe("2026-09-29T20:00:00.000Z");
  });

  it("answers 503 once the last forecast is too old to show", async () => {
    await service.describe(USER, "home");
    at("2026-09-30T02:00:01Z");
    snapshot.mockRejectedValue(
      new ProviderError("openweather", "unauthorized", 401),
    );
    await expect(service.describe(USER, "home")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("answers 503 when nothing was ever fetched", async () => {
    snapshot.mockRejectedValue(
      new ProviderError("openweather", "rate_limited", 429),
    );
    await expect(service.describe(USER, "home")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("answers 503 without calling out when no key is configured", async () => {
    client.configured = false;
    await expect(service.describe(USER, "home")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("looks the location up first, so another user's is a 404 before any fetch", async () => {
    describeLocation.mockRejectedValue(new Error("not found"));
    await expect(service.describe(USER, "theirs")).rejects.toThrow("not found");
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("recovers once the provider answers again", async () => {
    await service.describe(USER, "home");
    at("2026-09-29T22:00:00Z");
    snapshot.mockRejectedValueOnce(new ProviderError("openweather", "timeout"));
    expect((await service.describe(USER, "home")).stale).toBe(true);
    const fresh = await service.describe(USER, "home");
    expect(fresh.stale).toBe(false);
    expect(fresh.fetchedTime.toISOString()).toBe("2026-09-29T22:00:00.000Z");
  });

  describe("history", () => {
    const PLACE = { latitude: 47.85, longitude: -122.24 };

    it("keeps each fetch for its place, not each read", async () => {
      await service.describe(USER, "home");
      at("2026-09-29T20:10:00Z");
      await service.describe(USER, "home");
      expect(history.record).toHaveBeenCalledTimes(1);
      const [place, kept, fetchedAt] = history.record.mock.calls[0];
      expect(place).toEqual(PLACE);
      expect(kept).toEqual(await snapshot.mock.results[0].value);
      expect(fetchedAt.toISOString()).toBe("2026-09-29T20:00:00.000Z");
    });

    it("reads the place's history from the start of its local day", async () => {
      await service.describe(USER, "home");
      const [place, from] = history.since.mock.calls[0];
      expect(place).toEqual(PLACE);
      // 1 PM in Seattle: today began at midnight PDT.
      expect(from.toISOString()).toBe("2026-09-29T07:00:00.000Z");
    });

    it("builds today from the history as well as the forecast", async () => {
      history.since.mockResolvedValue({
        // This morning's forecast: colder than anything still to come.
        steps: [step(1_790_683_200, 41.3)],
        temperaturesF: [44],
      });
      const forecast = await service.describe(USER, "home");
      expect(forecast.days[0].lowF).toBe(41.3);
      expect(forecast.current.lowF).toBe(41.3);
    });

    it("serves the forecast alone when the history cannot be read", async () => {
      history.since.mockRejectedValue(new Error("Hasura away"));
      const forecast = await service.describe(USER, "home");
      expect(forecast.days).toHaveLength(5);
      expect(forecast.stale).toBe(false);
    });

    it("serves the forecast when the history cannot be written", async () => {
      history.record.mockRejectedValue(new Error("Hasura away"));
      const forecast = await service.describe(USER, "home");
      expect(forecast.stale).toBe(false);
      expect(history.prune).not.toHaveBeenCalled();
    });

    it("prunes what is older than two days, at most hourly", async () => {
      await service.describe(USER, "home");
      expect(history.prune).toHaveBeenCalledTimes(1);
      expect(history.prune.mock.calls[0][0].toISOString()).toBe(
        "2026-09-27T20:00:00.000Z",
      );
      at("2026-09-29T20:30:00Z");
      await service.describe(USER, "home");
      expect(history.record).toHaveBeenCalledTimes(2);
      expect(history.prune).toHaveBeenCalledTimes(1);
      at("2026-09-29T21:00:00Z");
      await service.describe(USER, "home");
      expect(history.prune).toHaveBeenCalledTimes(2);
    });
  });

  it("keys by the coordinate rounded to two places", () => {
    expect(cacheKey(47.8525684, -122.238287)).toBe("47.85,-122.24");
    expect(cacheKey(19.6106071, -155.9723704)).toBe("19.61,-155.97");
  });
});
