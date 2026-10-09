import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import { RainViewerClient } from "../../../../../src/olympus/weather/providers/RainViewerClient";

describe("RainViewerClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks for 256-pixel tiles in Universal Blue, smoothed, with snow", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      config: { method: "get" },
      data: new Uint8Array([1, 2]).buffer,
    }));
    vi.spyOn(axios, "create").mockReturnValue({ get } as never);
    const client = new RainViewerClient({
      providerTimeoutMs: 5000,
    } as WeatherConfigType);

    const png = await client.tile(
      "https://tilecache.rainviewer.com",
      { time: 1_790_711_700, path: "/v2/radar/1790711700" },
      7,
      20,
      44,
    );

    expect(get).toHaveBeenCalledWith(
      "https://tilecache.rainviewer.com/v2/radar/1790711700/256/7/20/44/2/1_1.png",
      { responseType: "arraybuffer" },
    );
    expect([...png]).toEqual([1, 2]);
  });

  it("stops short of RainViewer's limit of 100 a minute", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      config: { method: "get" },
      data: { version: "2.0", generated: 0, host: "", radar: { past: [] } },
    }));
    vi.spyOn(axios, "create").mockReturnValue({ get } as never);
    const client = new RainViewerClient({
      providerTimeoutMs: 5000,
    } as WeatherConfigType);

    const results = await Promise.allSettled(
      Array.from({ length: 95 }, () => client.maps()),
    );
    const refused = results.filter((r) => r.status === "rejected");
    expect(get).toHaveBeenCalledTimes(RainViewerClient.PER_MINUTE);
    expect(refused).toHaveLength(95 - RainViewerClient.PER_MINUTE);
  });
});
