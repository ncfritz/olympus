import moment from "moment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeatherRollupService } from "../../../../../src/olympus/weather/services/WeatherRollupService";

const operation = (document: unknown) =>
  /\b(?:query|mutation)\s+(\w+)/.exec(String(document))?.[1];

describe("WeatherRollupService", () => {
  let request: ReturnType<typeof vi.fn>;
  let service: WeatherRollupService;

  beforeEach(() => {
    request = vi.fn(async (document: unknown) => {
      switch (operation(document)) {
        case "ListWeatherRollupTiers":
          return {
            olympus_weather_rollup_tiers: [
              {
                name: "1h",
                bucket: "01:00:00",
                sourceTier: "30m",
                builtUntil: null,
              },
              {
                name: "1m",
                bucket: "00:01:00",
                sourceTier: null,
                builtUntil: "2026-09-29T12:07:00+00:00",
              },
              {
                name: "5m",
                bucket: "00:05:00",
                sourceTier: "1m",
                builtUntil: null,
              },
            ],
          };
        case "RollupWeatherSamples":
          return {
            olympus_weather_rollup_samples: [
              { tier: "1m", rowsWritten: 32, rowsPruned: 0 },
            ],
          };
        case "RollupWeatherTier":
          return {
            olympus_weather_rollup_tier: [
              { tier: "5m", rowsWritten: 8, rowsPruned: 0 },
            ],
          };
        case "PruneWeatherRollups":
          return {
            olympus_weather_prune: [
              { tier: "samples", rowsWritten: 0, rowsPruned: 5400 },
              { tier: "1m", rowsWritten: 0, rowsPruned: 16 },
            ],
          };
        default:
          throw new Error(`unexpected ${operation(document)}`);
      }
    });
    service = new WeatherRollupService({ request } as never);
  });

  it("lists the tiers finest first, with Postgres's intervals in seconds", async () => {
    const tiers = await service.tiers();
    expect(tiers.map((t) => [t.name, t.bucketSeconds])).toEqual([
      ["1m", 60],
      ["5m", 300],
      ["1h", 3600],
    ]);
    expect(tiers[0].builtUntil?.toISOString()).toBe("2026-09-29T12:07:00.000Z");
    expect(tiers[1].builtUntil).toBeNull();
  });

  it("builds the finest tier from the samples and the others from their source", async () => {
    const [finest, coarse] = await service.tiers();
    const from = moment.utc("2026-09-29T12:00:00Z");
    const to = moment.utc("2026-09-29T12:10:00Z");

    expect(await service.build(finest, from, to)).toBe(32);
    expect(await service.build(coarse, from, to)).toBe(8);

    const [, samples, tier] = request.mock.calls;
    expect(operation(samples[0])).toBe("RollupWeatherSamples");
    expect(samples[1]).toEqual({
      fromTime: "2026-09-29T12:00:00.000Z",
      toTime: "2026-09-29T12:10:00.000Z",
    });
    expect(operation(tier[0])).toBe("RollupWeatherTier");
    expect(tier[1]).toMatchObject({ tier: "5m" });
  });

  it("answers what pruning removed, by tier", async () => {
    const pruned = await service.prune(moment.utc("2026-09-27T12:00:00Z"));
    expect(pruned).toEqual({ samples: 5400, "1m": 16 });
    expect(request.mock.calls[0][1]).toEqual({
      sampleCutoff: "2026-09-27T12:00:00.000Z",
    });
  });
});
