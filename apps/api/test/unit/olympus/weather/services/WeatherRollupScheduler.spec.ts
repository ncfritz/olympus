import moment, { type Moment } from "moment";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import { WeatherRollupScheduler } from "../../../../../src/olympus/weather/services/WeatherRollupScheduler";
import type { RollupTier } from "../../../../../src/olympus/weather/services/WeatherRollupService";

const at = (iso: string) => moment.utc(iso);

const tiers = (
  built: Partial<Record<"1m" | "5m" | "1h", string>>,
): RollupTier[] => [
  {
    name: "1m",
    bucketSeconds: 60,
    sourceTier: null,
    builtUntil: built["1m"] ? at(built["1m"]) : null,
  },
  {
    name: "5m",
    bucketSeconds: 300,
    sourceTier: "1m",
    builtUntil: built["5m"] ? at(built["5m"]) : null,
  },
  {
    name: "1h",
    bucketSeconds: 3600,
    sourceTier: "5m",
    builtUntil: built["1h"] ? at(built["1h"]) : null,
  },
];

describe("WeatherRollupScheduler", () => {
  let build: ReturnType<typeof vi.fn>;
  let prune: ReturnType<typeof vi.fn>;
  let listTiers: ReturnType<typeof vi.fn>;
  let replays: { running: boolean };
  let backfills: { running: boolean };
  let scheduler: WeatherRollupScheduler;
  const built: string[] = [];

  const make = (rollupsEnabled = true) =>
    new WeatherRollupScheduler(
      { tiers: listTiers, build, prune } as never,
      replays as never,
      backfills as never,
      {
        stations: { sampleRetentionHours: 48, rollupsEnabled },
      } as WeatherConfigType,
    );

  beforeEach(() => {
    built.length = 0;
    build = vi.fn(async (tier: RollupTier, from: Moment, to: Moment) => {
      built.push(`${tier.name} ${from.toISOString()}..${to.toISOString()}`);
      return 1;
    });
    prune = vi.fn(async () => ({}));
    listTiers = vi.fn();
    replays = { running: false };
    backfills = { running: false };
    scheduler = make();
  });

  afterEach(() => {
    scheduler.onApplicationShutdown();
    vi.useRealTimers();
  });

  it("builds each tier from a bucket before where it stopped, up to what its source has", async () => {
    listTiers.mockResolvedValue(
      tiers({
        "1m": "2026-09-29T12:07:00Z",
        "5m": "2026-09-29T12:05:00Z",
        "1h": "2026-09-29T12:00:00Z",
      }),
    );

    await scheduler.build(at("2026-09-29T12:08:45Z"));

    expect(built).toEqual([
      // The 1m tier up to 30 seconds ago: the minute 12:08 is not settled.
      "1m 2026-09-29T12:06:00.000Z..2026-09-29T12:08:15.000Z",
      // Each coarser tier up to its source's new built_until.
      "5m 2026-09-29T12:00:00.000Z..2026-09-29T12:08:00.000Z",
      "1h 2026-09-29T11:00:00.000Z..2026-09-29T12:05:00.000Z",
    ]);
  });

  it("catches a tier up from wherever it stopped", async () => {
    listTiers.mockResolvedValue(
      tiers({
        "1m": "2026-09-26T00:00:00Z",
        "5m": "2026-09-26T00:00:00Z",
        "1h": "2026-09-26T00:00:00Z",
      }),
    );
    await scheduler.build(at("2026-09-29T12:00:45Z"));
    expect(built[0]).toBe(
      "1m 2026-09-25T23:59:00.000Z..2026-09-29T12:00:15.000Z",
    );
  });

  it("starts a tier never built as far back as samples are kept", async () => {
    listTiers.mockResolvedValue(tiers({}));
    await scheduler.build(at("2026-09-29T12:00:45Z"));
    expect(built).toEqual([
      "1m 2026-09-27T12:00:00.000Z..2026-09-29T12:00:15.000Z",
      "5m 2026-09-27T12:00:00.000Z..2026-09-29T12:00:00.000Z",
      "1h 2026-09-27T12:00:00.000Z..2026-09-29T12:00:00.000Z",
    ]);
  });

  it("builds nothing for a tier whose source has nothing yet", async () => {
    listTiers.mockResolvedValue(
      tiers({ "1m": "2026-09-29T12:00:00Z" }).map((tier) =>
        tier.name === "1m" ? { ...tier, builtUntil: null } : tier,
      ),
    );
    // 1m builds; 5m follows the 1m it just built; 1h follows 5m.
    await scheduler.build(at("2026-09-29T12:00:45Z"));
    expect(built.map((b) => b.split(" ")[0])).toEqual(["1m", "5m", "1h"]);

    built.length = 0;
    build.mockImplementation(
      async (tier: RollupTier, from: Moment, to: Moment) => {
        built.push(`${tier.name} ${from.toISOString()}..${to.toISOString()}`);
        return 0;
      },
    );
    listTiers.mockResolvedValue([
      { name: "5m", bucketSeconds: 300, sourceTier: "1m", builtUntil: null },
    ]);
    await scheduler.build(at("2026-09-29T12:00:45Z"));
    expect(built).toEqual([]);
  });

  it("prunes samples past retention, but never ones the 1m tier has not reached", async () => {
    listTiers.mockResolvedValue(tiers({ "1m": "2026-09-29T11:59:00Z" }));
    await scheduler.prune(at("2026-09-29T12:00:00Z"));
    expect(prune.mock.calls[0][0].toISOString()).toBe(
      "2026-09-27T12:00:00.000Z",
    );

    listTiers.mockResolvedValue(tiers({ "1m": "2026-09-20T00:00:00Z" }));
    await scheduler.prune(at("2026-09-29T12:00:00Z"));
    expect(prune.mock.calls[1][0].toISOString()).toBe(
      "2026-09-19T00:00:00.000Z",
    );
  });

  describe("the schedule", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-29T12:00:45Z"));
      listTiers.mockResolvedValue(tiers({ "1m": "2026-09-29T12:00:00Z" }));
    });

    it("builds every minute and prunes every hour", async () => {
      scheduler.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(build).toHaveBeenCalled();
      expect(prune).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(59 * 60_000);
      expect(prune).toHaveBeenCalledTimes(1);
    });

    it("waits while a replay runs", async () => {
      replays.running = true;
      scheduler.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(60 * 60_000);
      expect(build).not.toHaveBeenCalled();
      expect(prune).not.toHaveBeenCalled();
    });

    it("waits while a backfill runs", async () => {
      backfills.running = true;
      scheduler.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(60 * 60_000);
      expect(build).not.toHaveBeenCalled();
      expect(prune).not.toHaveBeenCalled();
    });

    it("does not start when rollups are off here", async () => {
      scheduler = make(false);
      scheduler.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(60 * 60_000);
      expect(listTiers).not.toHaveBeenCalled();
    });

    it("carries on after a failed run", async () => {
      listTiers.mockRejectedValueOnce(new Error("Hasura away"));
      scheduler.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(build).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(build).toHaveBeenCalled();
    });
  });
});
