import { BadRequestException, NotFoundException } from "@nestjs/common";
import moment from "moment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseTier,
  DAILY,
  toSeriesRequest,
  WeatherSeriesService,
} from "../../../../../src/olympus/weather/services/WeatherSeriesService";
import type { RollupTier } from "../../../../../src/olympus/weather/services/WeatherRollupService";

const DAY = 86_400;
const TIERS: RollupTier[] = [
  {
    name: "1m",
    bucketSeconds: 60,
    retentionSeconds: 7 * DAY,
    sourceTier: null,
    builtUntil: null,
  },
  {
    name: "5m",
    bucketSeconds: 300,
    retentionSeconds: 30 * DAY,
    sourceTier: "1m",
    builtUntil: null,
  },
  {
    name: "15m",
    bucketSeconds: 900,
    retentionSeconds: 90 * DAY,
    sourceTier: "5m",
    builtUntil: null,
  },
  {
    name: "30m",
    bucketSeconds: 1800,
    retentionSeconds: 180 * DAY,
    sourceTier: "15m",
    builtUntil: null,
  },
  {
    name: "1h",
    bucketSeconds: 3600,
    retentionSeconds: null,
    sourceTier: "30m",
    builtUntil: null,
  },
];
const NOW = moment.utc("2026-09-29T20:00:00Z");
const back = (days: number) => NOW.clone().subtract(days, "days");

describe("chooseTier", () => {
  it.each([
    ["24 hours", 1, "1m"],
    // 1m holds it, but 2 days of minutes is 2,880 points.
    ["2 days", 2, "5m"],
    // 1m and 5m hold a week, but 5m is 2,016 points.
    ["a week", 7, "15m"],
    // Older than 1m and 5m keep; 20 days of 15m is 1,920 points.
    ["20 days", 20, "15m"],
    ["30 days", 30, "30m"],
    ["60 days", 60, "1h"],
    // 8,760 hours: days.
    ["a year", 365, "1d"],
    ["three years", 3 * 365, "1d"],
  ])("picks for %s: %s", (_case, days, tier) => {
    expect(
      chooseTier([...TIERS, DAILY], "auto", back(days), NOW, NOW).name,
    ).toBe(tier);
  });

  it("falls back to the finest tier that fits when none holds the start", () => {
    // 40 days back is past every tier's retention here; the hourly tier
    // still fits (960 points), and has whatever it has.
    const short = [TIERS[0], { ...TIERS[4], retentionSeconds: 30 * DAY }];
    expect(chooseTier(short, "auto", back(40), NOW, NOW).name).toBe("1h");
  });

  it("refuses a range nothing fits", () => {
    expect(() =>
      chooseTier([...TIERS, DAILY], "auto", back(10 * 365), NOW, NOW),
    ).toThrow(BadRequestException);
  });

  it("takes a tier asked for, if it fits", () => {
    expect(chooseTier(TIERS, "15m", back(1), NOW, NOW).name).toBe("15m");
    expect(() => chooseTier(TIERS, "1m", back(3), NOW, NOW)).toThrow(
      /more than 2000 points/,
    );
    expect(() => chooseTier(TIERS, "2m", back(1), NOW, NOW)).toThrow(
      /resolution must be/,
    );
  });
});

describe("toSeriesRequest", () => {
  const good = {
    metrics: "outdoor_temperature, rain",
    from: "2026-09-28T20:00:00Z",
    to: "2026-09-29T20:00:00Z",
  };

  it("reads the query", () => {
    const request = toSeriesRequest(good);
    expect(request.metrics).toEqual(["outdoor_temperature", "rain"]);
    expect(request.resolution).toBe("auto");
    expect(request.from.toISOString()).toBe("2026-09-28T20:00:00.000Z");
  });

  it.each([
    ["no metrics", { ...good, metrics: undefined }],
    ["an empty list", { ...good, metrics: " , " }],
    ["a repeat", { ...good, metrics: "rain,rain" }],
    [
      "13 metrics",
      {
        ...good,
        metrics: Array.from({ length: 13 }, (_, i) => `m${i}`).join(","),
      },
    ],
    ["a bad from", { ...good, from: "yesterday" }],
    ["no to", { ...good, to: undefined }],
    ["to before from", { ...good, to: "2026-09-27T20:00:00Z" }],
  ])("refuses %s", (_case, query) => {
    expect(() => toSeriesRequest(query)).toThrow(BadRequestException);
  });
});

describe("WeatherSeriesService", () => {
  let request: ReturnType<typeof vi.fn>;
  let describeStation: ReturnType<typeof vi.fn>;
  let service: WeatherSeriesService;

  const bucket = (
    metric: string,
    start: string,
    values: { count: number; sum: number; min?: number; max?: number },
  ) => ({
    bucketStart: start,
    sampleCount: values.count,
    sum: values.sum,
    min: values.min ?? 0,
    max: values.max ?? 0,
    first: values.min ?? 0,
    last: values.max ?? 0,
    metric: { name: metric },
  });

  beforeEach(() => {
    describeStation = vi.fn().mockResolvedValue({ id: "station-1" });
    request = vi.fn(async (document: unknown) => {
      const name = /\b(?:query)\s+(\w+)/.exec(String(document))?.[1];
      if (name === "ListWeatherMetrics") {
        return {
          olympus_weather_metrics: [
            { name: "outdoor_temperature", unit: "F", rollup: "mean" },
            { name: "rain", unit: "in", rollup: "sum" },
            { name: "wind_x", unit: "mph", rollup: "vector_x" },
            { name: "wind_y", unit: "mph", rollup: "vector_y" },
          ],
        };
      }
      return {
        olympus_weather_station_rollups: [
          bucket("outdoor_temperature", "2026-09-29T19:00:00+00:00", {
            count: 4,
            sum: 230,
            min: 56,
            max: 59,
          }),
          bucket("rain", "2026-09-29T19:00:00+00:00", { count: 4, sum: 0.12 }),
          // Wind from the north-west: x negative, y positive, equal.
          bucket("wind_x", "2026-09-29T19:00:00+00:00", { count: 4, sum: -20 }),
          bucket("wind_y", "2026-09-29T19:00:00+00:00", { count: 4, sum: 20 }),
          // And across north, just east of it.
          bucket("wind_x", "2026-09-29T19:15:00+00:00", { count: 2, sum: 0.2 }),
          bucket("wind_y", "2026-09-29T19:15:00+00:00", { count: 2, sum: 10 }),
          // A bucket with only one component: no direction.
          bucket("wind_x", "2026-09-29T19:30:00+00:00", { count: 1, sum: 1 }),
          bucket("outdoor_temperature", "2026-09-29T19:15:00+00:00", {
            count: 2,
            sum: 117,
            min: 58,
            max: 59,
          }),
        ],
      };
    });
    service = new WeatherSeriesService(
      { request } as never,
      { describe: describeStation } as never,
      { tiers: vi.fn().mockResolvedValue(TIERS) } as never,
    );
  });

  const ask = (metrics: string[], resolution = "15m") =>
    service.series(
      "station-1",
      { metrics, from: back(1), to: NOW, resolution },
      NOW,
    );

  it("answers each metric in the order asked, with its buckets' statistics", async () => {
    const [rain, temperature] = await ask(["rain", "outdoor_temperature"]);
    expect(rain).toMatchObject({
      metric: "rain",
      unit: "in",
      rollup: "sum",
      resolution: "15m",
    });
    expect(
      temperature.points.map((p) => [
        p.time.toISOString(),
        p.mean,
        p.min,
        p.max,
      ]),
    ).toEqual([
      ["2026-09-29T19:00:00.000Z", 57.5, 56, 59],
      ["2026-09-29T19:15:00.000Z", 58.5, 58, 59],
    ]);
    expect(rain.points[0].sum).toBeCloseTo(0.12);
  });

  it("asks Hasura for the tier, the range and the stored metrics", async () => {
    await ask(["outdoor_temperature", "wind_direction"]);
    const call = request.mock.calls.find(([d]) =>
      /ListWeatherStationSeries/.test(String(d)),
    );
    expect(call?.[1]).toEqual({
      stationId: "station-1",
      tier: "15m",
      metrics: ["outdoor_temperature", "wind_x", "wind_y"],
      from: "2026-09-28T20:00:00.000Z",
      to: "2026-09-29T20:00:00.000Z",
    });
  });

  it("recombines wind direction from its components, across north", async () => {
    const [direction] = await ask(["wind_direction"]);
    expect(direction).toMatchObject({
      metric: "wind_direction",
      unit: "deg",
      rollup: "vector",
    });
    expect(direction.points.map((p) => [p.time.toISOString(), p.mean])).toEqual(
      [
        ["2026-09-29T19:00:00.000Z", 315],
        ["2026-09-29T19:15:00.000Z", 1.1],
      ],
    );
  });

  it("combines hours into whole UTC days for 1d", async () => {
    request.mockImplementation(async (document: unknown) => {
      if (/ListWeatherMetrics/.test(String(document))) {
        return {
          olympus_weather_metrics: [
            { name: "outdoor_temperature", unit: "F", rollup: "mean" },
          ],
        };
      }
      return {
        olympus_weather_station_rollups: [
          bucket("outdoor_temperature", "2026-09-28T22:00:00+00:00", {
            count: 60,
            sum: 3000,
            min: 48,
            max: 52,
          }),
          bucket("outdoor_temperature", "2026-09-28T23:00:00+00:00", {
            count: 60,
            sum: 2940,
            min: 47,
            max: 50,
          }),
          bucket("outdoor_temperature", "2026-09-29T00:00:00+00:00", {
            count: 30,
            sum: 1500,
            min: 49,
            max: 51,
          }),
        ],
      };
    });
    const [series] = await service.series(
      "station-1",
      {
        metrics: ["outdoor_temperature"],
        from: back(30),
        to: NOW,
        resolution: "1d",
      },
      NOW,
    );
    const call = request.mock.calls.find(([d]) =>
      /ListWeatherStationSeries/.test(String(d)),
    );
    expect(call?.[1]).toMatchObject({ tier: "1h" });
    expect(series.resolution).toBe("1d");
    expect(
      series.points.map((p) => [
        p.time.toISOString(),
        p.count,
        p.mean,
        p.min,
        p.max,
        p.first,
        p.last,
      ]),
    ).toEqual([
      ["2026-09-28T00:00:00.000Z", 120, 49.5, 47, 52, 48, 50],
      ["2026-09-29T00:00:00.000Z", 30, 50, 49, 51, 49, 51],
    ]);
  });

  it("refuses a metric there is no such thing as", async () => {
    await expect(ask(["humidex"])).rejects.toThrow(/humidex is not one/);
  });

  it("answers 404 for a station that is not there", async () => {
    describeStation.mockRejectedValue(new NotFoundException());
    await expect(ask(["rain"])).rejects.toBeInstanceOf(NotFoundException);
  });
});
