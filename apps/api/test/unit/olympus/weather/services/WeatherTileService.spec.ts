import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { WeatherMapLayer } from "@ncfritz/olympus-model";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import { ProviderError } from "../../../../../src/olympus/weather/providers/ProviderError";
import type { RainViewerMaps } from "../../../../../src/olympus/weather/providers/rainViewerTypes";
import { WeatherTileService } from "../../../../../src/olympus/weather/services/WeatherTileService";

/** 2026-09-29T20:00:00Z */
const NOW = 1_790_712_000;

const maps = (latest = NOW - 300): RainViewerMaps => ({
  version: "2.0",
  generated: latest,
  host: "https://tilecache.rainviewer.com",
  radar: {
    past: Array.from({ length: 13 }, (_, i) => ({
      time: latest - (12 - i) * 600,
      path: `/v2/radar/${latest - (12 - i) * 600}`,
    })),
  },
});

const png = (size: number, fill = 1) => Buffer.alloc(size, fill);

const config = (cacheMb = 128) =>
  ({ tiles: { cacheMb, ttlSeconds: 1800 } }) as WeatherConfigType;

describe("WeatherTileService", () => {
  let openWeather: { tile: ReturnType<typeof vi.fn> };
  let rainViewer: {
    maps: ReturnType<typeof vi.fn>;
    tile: ReturnType<typeof vi.fn>;
  };
  let service: WeatherTileService;

  const build = (cacheMb?: number) =>
    new WeatherTileService(
      openWeather as never,
      rainViewer as never,
      config(cacheMb),
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW * 1000));
    openWeather = { tile: vi.fn().mockResolvedValue(png(1000)) };
    rainViewer = {
      maps: vi.fn().mockResolvedValue(maps()),
      tile: vi.fn().mockResolvedValue(png(800)),
    };
    service = build();
  });

  afterEach(() => vi.useRealTimers());

  describe("layer tiles", () => {
    it("fetches once and serves the cache after, counting down its age", async () => {
      const first = await service.layerTile("precipitation", 8, 41, 89);
      expect(first.maxAgeSeconds).toBe(1800);
      vi.setSystemTime(new Date((NOW + 600) * 1000));
      const second = await service.layerTile("precipitation", 8, 41, 89);
      expect(openWeather.tile).toHaveBeenCalledTimes(1);
      expect(openWeather.tile).toHaveBeenCalledWith(
        WeatherMapLayer.Precipitation,
        8,
        41,
        89,
      );
      expect(second.png.equals(first.png)).toBe(true);
    });

    it("keeps layers apart", async () => {
      await service.layerTile("precipitation", 8, 41, 89);
      await service.layerTile("clouds", 8, 41, 89);
      expect(openWeather.tile).toHaveBeenCalledTimes(2);
    });

    it("shares one fetch between concurrent requests for a tile", async () => {
      await Promise.all([
        service.layerTile("wind", 8, 1, 1),
        service.layerTile("wind", 8, 1, 1),
        service.layerTile("wind", 8, 1, 1),
      ]);
      expect(openWeather.tile).toHaveBeenCalledTimes(1);
    });

    it("drops the least recently used tiles past its size", async () => {
      service = build(1); // 1 MB
      openWeather.tile.mockImplementation(async () => png(400 * 1024));
      await service.layerTile("temperature", 8, 0, 0);
      await service.layerTile("temperature", 8, 0, 1);
      await service.layerTile("temperature", 8, 0, 0); // touch the first
      await service.layerTile("temperature", 8, 0, 2); // evicts 0/1
      expect(openWeather.tile).toHaveBeenCalledTimes(3);
      await service.layerTile("temperature", 8, 0, 0); // still there
      expect(openWeather.tile).toHaveBeenCalledTimes(3);
      await service.layerTile("temperature", 8, 0, 1); // was evicted
      expect(openWeather.tile).toHaveBeenCalledTimes(4);
    });

    it.each([
      ["an unknown layer", "humidity", 8, 1, 1],
      ["a zoom past the limit", "clouds", 11, 1, 1],
      ["a negative zoom", "clouds", -1, 0, 0],
      ["a column off the map", "clouds", 2, 4, 0],
      ["a row off the map", "clouds", 2, 0, 4],
    ])("refuses %s before asking the provider", async (_c, layer, z, x, y) => {
      await expect(
        service.layerTile(
          layer as string,
          z as number,
          x as number,
          y as number,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(openWeather.tile).not.toHaveBeenCalled();
    });

    it("answers 503 when the provider fails, and does not cache the failure", async () => {
      openWeather.tile.mockRejectedValueOnce(
        new ProviderError("openweather", "rate_limited"),
      );
      await expect(service.layerTile("clouds", 8, 1, 1)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await service.layerTile("clouds", 8, 1, 1);
      expect(openWeather.tile).toHaveBeenCalledTimes(2);
    });

    it("answers 503 naming configuration when there is no key", async () => {
      openWeather.tile.mockRejectedValue(
        new ProviderError("openweather", "not_configured"),
      );
      await expect(service.layerTile("clouds", 8, 1, 1)).rejects.toThrow(
        "Map layers are not configured on this server",
      );
    });
  });

  describe("radar", () => {
    it("lists the frames oldest first, by their time", async () => {
      const frames = await service.radarFrames();
      expect(frames).toHaveLength(13);
      expect(frames[0].id).toBe(String(NOW - 300 - 12 * 600));
      expect(frames[12].time.toISOString()).toBe("2026-09-29T19:55:00.000Z");
    });

    it("reuses the frame list for five minutes", async () => {
      await service.radarFrames();
      vi.setSystemTime(new Date((NOW + 299) * 1000));
      await service.radarFrames();
      expect(rainViewer.maps).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date((NOW + 301) * 1000));
      await service.radarFrames();
      expect(rainViewer.maps).toHaveBeenCalledTimes(2);
    });

    it("keeps serving the old list while RainViewer fails, for a while", async () => {
      await service.radarFrames();
      rainViewer.maps.mockRejectedValue(
        new ProviderError("rainviewer", "timeout"),
      );
      vi.setSystemTime(new Date((NOW + 20 * 60) * 1000));
      expect(await service.radarFrames()).toHaveLength(13);
      vi.setSystemTime(new Date((NOW + 31 * 60) * 1000));
      await expect(service.radarFrames()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("fetches a listed frame's tile and keeps it as long as the frame lives", async () => {
      const frame = maps().radar.past[12];
      const tile = await service.radarTile(String(frame.time), 7, 20, 44);
      expect(rainViewer.tile).toHaveBeenCalledWith(
        "https://tilecache.rainviewer.com",
        frame,
        7,
        20,
        44,
      );
      // Listed for two hours from its time, and ten minutes more.
      expect(tile.maxAgeSeconds).toBe(frame.time + 7800 - NOW);
    });

    it("answers 404 for a frame that is not listed", async () => {
      await expect(service.radarTile("1234", 7, 20, 44)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(rainViewer.tile).not.toHaveBeenCalled();
    });

    it("refuses zoom 8, which RainViewer does not serve", async () => {
      const frame = maps().radar.past[12];
      await expect(
        service.radarTile(String(frame.time), 8, 40, 88),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(rainViewer.maps).not.toHaveBeenCalled();
    });
  });
});
