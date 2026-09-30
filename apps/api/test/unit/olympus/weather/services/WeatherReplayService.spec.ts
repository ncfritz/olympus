import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BadRequestException, ConflictException } from "@nestjs/common";
import moment from "moment";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import {
  toReplayRequest,
  WeatherReplayService,
} from "../../../../../src/olympus/weather/services/WeatherReplayService";

const TIERS = [
  { name: "1m", bucketSeconds: 60, sourceTier: null, builtUntil: null },
  { name: "5m", bucketSeconds: 300, sourceTier: "1m", builtUntil: null },
  { name: "1h", bucketSeconds: 3600, sourceTier: "5m", builtUntil: null },
];

describe("WeatherReplayService", () => {
  let dir: string;
  let ingest: ReturnType<typeof vi.fn>;
  let build: ReturnType<typeof vi.fn>;
  let prune: ReturnType<typeof vi.fn>;
  let service: WeatherReplayService;
  const calls: string[] = [];

  const writeDay = (station: string, day: string, lines: number) => {
    const [yyyy, mm, dd] = day.split("-");
    const month = join(dir, station, yyyy, mm);
    mkdirSync(month, { recursive: true });
    writeFileSync(
      join(month, `${dd}.jsonl`),
      Array.from({ length: lines }, (_, i) =>
        JSON.stringify({
          receivedAt: `${day}T00:00:00Z`,
          source: "push",
          query: `&n=${i}`,
        }),
      ).join("\n") + "\n",
    );
  };

  const request = (from: string, to: string) => ({
    from: moment.utc(from),
    to: moment.utc(to),
    mode: "ignore" as const,
    dir,
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    dir = mkdtempSync(join(tmpdir(), "weather-replay-"));
    calls.length = 0;
    ingest = vi.fn(async (lines: unknown[]) => {
      calls.push(`ingest ${lines.length}`);
      return {
        counts: {
          stored: lines.length,
          duplicate: 0,
          unknown_station: 0,
          invalid: 0,
          skipped: 0,
        },
        errors: [],
      };
    });
    build = vi.fn(async (tier: { name: string }, from, to) => {
      calls.push(
        `build ${tier.name} ${from.toISOString()}..${to.toISOString()}`,
      );
      return 1;
    });
    prune = vi.fn(async (cutoff) => {
      calls.push(`prune ${cutoff.toISOString()}`);
      return {};
    });
    service = new WeatherReplayService(
      { ingest } as never,
      { tiers: async () => TIERS, build, prune } as never,
      {
        stations: { archiveDir: "/unused", sampleRetentionHours: 48 },
      } as WeatherConfigType,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads a day, builds every tier for it in order, then prunes; then the next day", async () => {
    writeDay("A0-B1-C2-D3-E4-F5", "2026-09-20", 2);
    writeDay("0A-1B-2C-3D-4E-5F", "2026-09-20", 1);
    writeDay("A0-B1-C2-D3-E4-F5", "2026-09-21", 1);

    const summary = await service.replay(request("2026-09-20", "2026-09-21"));

    const day1 = "2026-09-20T00:00:00.000Z..2026-09-21T00:00:00.000Z";
    const day2 = "2026-09-21T00:00:00.000Z..2026-09-22T00:00:00.000Z";
    expect(calls).toEqual([
      "ingest 1",
      "ingest 2",
      `build 1m ${day1}`,
      `build 5m ${day1}`,
      `build 1h ${day1}`,
      // Old days: everything before the finished day goes; it stays for
      // the next day's rain.
      "prune 2026-09-20T00:00:00.000Z",
      "ingest 1",
      `build 1m ${day2}`,
      `build 5m ${day2}`,
      `build 1h ${day2}`,
      "prune 2026-09-21T00:00:00.000Z",
    ]);
    expect(summary).toMatchObject({
      days: 2,
      files: 3,
      lines: 4,
      rollupRows: 6,
    });
    expect(summary.counts.stored).toBe(4);
  });

  it("prunes recent days only as far as retention allows", async () => {
    writeDay("A0-B1-C2-D3-E4-F5", "2026-09-30", 1);
    await service.replay(request("2026-09-30", "2026-09-30"));
    expect(calls.at(-1)).toBe("prune 2026-09-28T12:00:00.000Z");
  });

  it("sends at most 500 lines an insert", async () => {
    writeDay("A0-B1-C2-D3-E4-F5", "2026-09-20", 1201);
    await service.replay(request("2026-09-20", "2026-09-20"));
    expect(ingest.mock.calls.map(([lines]) => lines.length)).toEqual([
      500, 500, 201,
    ]);
    expect(ingest.mock.calls[0][0][0]).toMatchObject({
      macAddress: "A0:B1:C2:D3:E4:F5",
      line: { query: "&n=0" },
    });
    expect(ingest.mock.calls[0][1]).toBe("ignore");
  });

  it("builds nothing for a range with no archive", async () => {
    const summary = await service.replay(request("2026-09-01", "2026-09-02"));
    expect(calls).toEqual([]);
    expect(summary.days).toBe(0);
  });

  it("runs one replay at a time", async () => {
    writeDay("A0-B1-C2-D3-E4-F5", "2026-09-20", 1);
    const first = service.replay(request("2026-09-20", "2026-09-20"));
    expect(service.running).toBe(true);
    expect(() => service.replay(request("2026-09-20", "2026-09-20"))).toThrow(
      ConflictException,
    );
    await first;
    expect(service.running).toBe(false);
  });

  it("is free again after a replay fails", async () => {
    writeDay("A0-B1-C2-D3-E4-F5", "2026-09-20", 1);
    build.mockRejectedValueOnce(new Error("Hasura away"));
    await expect(
      service.replay(request("2026-09-20", "2026-09-20")),
    ).rejects.toThrow("Hasura away");
    expect(service.running).toBe(false);
  });
});

describe("toReplayRequest", () => {
  it("reads a replay, ignoring repeats by default", () => {
    const request = toReplayRequest({
      from: "2026-09-01",
      to: "2026-09-02",
      macAddress: "a0b1c2d3e4f5",
    });
    expect(request.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(request.to.toISOString()).toBe("2026-09-02T00:00:00.000Z");
    expect(request.macAddress).toBe("A0:B1:C2:D3:E4:F5");
    expect(request.mode).toBe("ignore");
    expect("dir" in request).toBe(false);
  });

  it.each([
    [undefined],
    [{ from: "2026-09-02", to: "2026-09-01" }],
    [{ from: "yesterday", to: "2026-09-01" }],
    [{ from: "2026-09-01", to: "2026-09-01", macAddress: "nope" }],
    [{ from: "2026-09-01", to: "2026-09-01", mode: "overwrite" }],
  ])("refuses %j", (replay) => {
    expect(() => toReplayRequest(replay as never)).toThrow(BadRequestException);
  });
});
