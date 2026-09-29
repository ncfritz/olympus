import { WeatherMapLayer } from "@ncfritz/olympus-model";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import { OpenWeatherClient } from "../../../../../src/olympus/weather/providers/OpenWeatherClient";
import { OpenWeatherLimiter } from "../../../../../src/olympus/weather/providers/OpenWeatherLimiter";
import {
  openWeatherCurrent,
  openWeatherForecast,
} from "../../../../fixtures/openWeather";

const config = (key?: string) =>
  ({ openWeatherApiKey: key, providerTimeoutMs: 5000 }) as WeatherConfigType;

describe("OpenWeatherClient", () => {
  afterEach(() => vi.restoreAllMocks());

  const withHttp = (get: ReturnType<typeof vi.fn>) =>
    vi.spyOn(axios, "create").mockReturnValue({ get } as never);

  it("asks for both endpoints in imperial units with the key", async () => {
    const get = vi.fn(async (path: string) => ({
      status: 200,
      config: { method: "get" },
      data: path === "/weather" ? openWeatherCurrent() : openWeatherForecast(),
    }));
    const create = withHttp(get);
    const client = new OpenWeatherClient(
      config("key-1"),
      new OpenWeatherLimiter(),
    );

    const snapshot = await client.snapshot(47.85, -122.24);

    expect(create).toHaveBeenCalledWith({
      baseURL: "https://api.openweathermap.org/data/2.5",
      timeout: 5000,
    });
    expect(create).toHaveBeenCalledWith({
      baseURL: "https://tile.openweathermap.org/map",
      timeout: 5000,
      responseType: "arraybuffer",
    });
    expect(get.mock.calls.map(([path]) => path).sort()).toEqual([
      "/forecast",
      "/weather",
    ]);
    for (const [, options] of get.mock.calls) {
      expect(options).toEqual({
        params: { lat: 47.85, lon: -122.24, units: "imperial", appid: "key-1" },
      });
    }
    expect(snapshot.current.main.temp).toBe(58.1);
    expect(snapshot.forecast.list).toHaveLength(40);
  });

  it("refuses without a key, before any request", async () => {
    const get = vi.fn();
    withHttp(get);
    const client = new OpenWeatherClient(config(), new OpenWeatherLimiter());
    expect(client.configured).toBe(false);
    await expect(client.snapshot(1, 2)).rejects.toMatchObject({
      reason: "not_configured",
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("turns a 404 into a provider error rather than an empty answer", async () => {
    const error = Object.assign(new Error("nope"), {
      isAxiosError: true,
      response: { status: 404, config: { method: "get" } },
    });
    withHttp(vi.fn().mockRejectedValue(error));
    const client = new OpenWeatherClient(
      config("key-1"),
      new OpenWeatherLimiter(),
    );
    await expect(client.snapshot(1, 2)).rejects.toMatchObject({
      reason: "not_found",
    });
  });

  it("asks for a layer's tile by OpenWeather's name for it, with the key", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      config: { method: "get" },
      data: new Uint8Array([137, 80, 78, 71]).buffer,
    }));
    withHttp(get);
    const client = new OpenWeatherClient(
      config("key-1"),
      new OpenWeatherLimiter(),
    );

    const png = await client.tile(WeatherMapLayer.Precipitation, 8, 41, 89);

    expect(get).toHaveBeenCalledWith("/precipitation_new/8/41/89.png", {
      params: { appid: "key-1" },
    });
    expect([...png]).toEqual([137, 80, 78, 71]);
  });

  it("refuses a call the rate limit has no room for, before any request", async () => {
    const get = vi.fn();
    withHttp(get);
    const limiter = new OpenWeatherLimiter();
    vi.spyOn(limiter, "takeForTile").mockReturnValue(false);
    const client = new OpenWeatherClient(config("key-1"), limiter);
    await expect(
      client.tile(WeatherMapLayer.Clouds, 8, 1, 1),
    ).rejects.toMatchObject({ reason: "rate_limited" });
    expect(get).not.toHaveBeenCalled();
  });
});
