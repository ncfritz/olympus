import { BadRequestException, ConflictException } from "@nestjs/common";
import moment, { type Moment } from "moment";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import {
  findGaps,
  toBackfillRequest,
  WeatherBackfillService,
} from "../../../../../src/olympus/weather/services/WeatherBackfillService";

const STATION = {
  id: "3b6f1d2c-0000-4000-8000-000000000001",
  name: "Mill Creek",
  macAddress: "A0:B1:C2:D3:E4:F5",
};
const at = (iso: string) => moment.utc(iso);
const iso = (m: Moment) => m.toISOString();

/** Ambient's records ending at `end`, newest first, every 5 minutes. */
const page = (end: Moment, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    dateutc: end.valueOf() - i * 5 * 60_000,
    tempf: 50 + i,
  }));

describe("findGaps", () => {
  const from = at("2026-09-29T00:00:00Z");
  const to = at("2026-09-29T02:00:00Z");

  it("finds stretches of more than ten minutes, including at either end", () => {
    const times = [
      "2026-09-29T00:12:00Z", // 12 minutes after the start
      "2026-09-29T00:20:00Z",
      "2026-09-29T01:00:00Z", // 40 minutes
      "2026-09-29T01:09:00Z", // 9: not a gap
      "2026-09-29T01:45:00Z", // 36 minutes; then 15 to the end
    ].map(at);
    expect(
      findGaps(times, from, to).map((g) => `${iso(g.from)}..${iso(g.to)}`),
    ).toEqual([
      "2026-09-29T00:00:00.000Z..2026-09-29T00:12:00.000Z",
      "2026-09-29T00:20:00.000Z..2026-09-29T01:00:00.000Z",
      "2026-09-29T01:09:00.000Z..2026-09-29T01:45:00.000Z",
      "2026-09-29T01:45:00.000Z..2026-09-29T02:00:00.000Z",
    ]);
  });

  it("is the whole range when there are no samples", () => {
    expect(findGaps([], from, to)).toHaveLength(1);
  });

  it("is nothing when samples are steady", () => {
    const times = Array.from({ length: 450 }, (_, i) =>
      from.clone().add(i * 16, "seconds"),
    );
    expect(findGaps(times, from, to)).toEqual([]);
  });
});

describe("WeatherBackfillService", () => {
  let request: ReturnType<typeof vi.fn>;
  let deviceData: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let ingest: ReturnType<typeof vi.fn>;
  let build: ReturnType<typeof vi.fn>;
  let service: WeatherBackfillService;
  let sampleTimes: string[];
  let configured: boolean;

  const make = (backfillEnabled = true) =>
    new WeatherBackfillService(
      { request } as never,
      {
        deviceData,
        get configured() {
          return configured;
        },
      } as never,
      {
        list: vi.fn().mockResolvedValue([STATION]),
        describe: vi.fn().mockResolvedValue(STATION),
      } as never,
      { append } as never,
      { ingest } as never,
      {
        tiers: vi.fn().mockResolvedValue([
          { name: "1m", bucketSeconds: 60, sourceTier: null, builtUntil: null },
          {
            name: "5m",
            bucketSeconds: 300,
            sourceTier: "1m",
            builtUntil: null,
          },
        ]),
        build,
      } as never,
      {
        stations: { sampleRetentionHours: 48, backfillEnabled },
      } as WeatherConfigType,
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T20:00:00Z"));
    configured = true;
    sampleTimes = [];
    request = vi.fn(async () => ({
      olympus_weather_station_samples: sampleTimes.map((observedTime) => ({
        observedTime,
      })),
    }));
    deviceData = vi.fn(async (_mac: string, end: Moment) => page(end, 12));
    append = vi.fn().mockResolvedValue(true);
    ingest = vi.fn(async (lines: { line: { response: unknown[] } }[]) => ({
      counts: {
        stored: lines[0].line.response.length,
        duplicate: 0,
        unknown_station: 0,
        invalid: 0,
        skipped: 0,
      },
      errors: [],
    }));
    build = vi.fn().mockResolvedValue(1);
    service = make();
  });

  afterEach(() => vi.useRealTimers());

  describe("filling gaps", () => {
    it("looks within the samples' retention, less an hour, up to 15 minutes ago", async () => {
      sampleTimes = [];
      deviceData.mockResolvedValue([]);
      await service.fillGaps();
      expect(request.mock.calls[0][1]).toEqual({
        stationId: STATION.id,
        from: "2026-09-27T21:00:00.000Z",
        to: "2026-09-29T19:45:00.000Z",
      });
    });

    it("fetches a gap back from its end until a page reaches its start", async () => {
      // Samples on either side of an hour-long gap, 16:00 to 17:00.
      sampleTimes = [
        ...Array.from({ length: 5 }, (_, i) =>
          iso(at("2026-09-27T21:00:00Z").add(i * 9, "hours")),
        ),
        "2026-09-29T16:00:00.000Z",
        "2026-09-29T17:00:00.000Z",
        "2026-09-29T17:09:00.000Z",
        "2026-09-29T17:18:00.000Z",
        "2026-09-29T17:27:00.000Z",
        "2026-09-29T17:36:00.000Z",
        "2026-09-29T17:45:00.000Z",
        "2026-09-29T17:54:00.000Z",
        "2026-09-29T18:03:00.000Z",
        "2026-09-29T18:12:00.000Z",
        "2026-09-29T18:21:00.000Z",
        "2026-09-29T18:30:00.000Z",
        "2026-09-29T18:39:00.000Z",
        "2026-09-29T18:48:00.000Z",
        "2026-09-29T18:57:00.000Z",
        "2026-09-29T19:06:00.000Z",
        "2026-09-29T19:15:00.000Z",
        "2026-09-29T19:24:00.000Z",
        "2026-09-29T19:33:00.000Z",
        "2026-09-29T19:42:00.000Z",
      ];
      // Ignore the gaps between the sparse early samples here.
      deviceData.mockImplementation(async (_mac: string, end: Moment) =>
        end.isAfter(at("2026-09-29T15:00:00Z")) ? page(end, 6) : [],
      );

      await service.fillGaps();

      const ends = deviceData.mock.calls.map(([, end]) => iso(end as Moment));
      // The 16:00-17:00 gap, from its end back: each page ends a
      // millisecond before the last one's oldest record, until a page
      // reaches past the gap's start.
      expect(ends.filter((e) => e > "2026-09-29T16:00:01")).toEqual([
        "2026-09-29T17:00:00.000Z",
        "2026-09-29T16:34:59.999Z",
        "2026-09-29T16:09:59.998Z",
      ]);
    });

    it("archives each response as a backfill line, without the request", async () => {
      sampleTimes = [];
      deviceData.mockResolvedValueOnce(page(at("2026-09-29T19:45:00Z"), 2));
      deviceData.mockResolvedValue([]);
      await service.fillGaps();

      const [mac, line] = append.mock.calls[0];
      expect(mac).toBe(STATION.macAddress);
      expect(line).toEqual({
        receivedAt: "2026-09-29T20:00:00.000Z",
        source: "backfill",
        response: page(at("2026-09-29T19:45:00Z"), 2),
      });
      expect(JSON.stringify(append.mock.calls)).not.toMatch(
        /apiKey|applicationKey/,
      );
      // Stored the way every archive line is, after it is archived.
      expect(ingest).toHaveBeenCalledWith([
        { macAddress: STATION.macAddress, line },
      ]);
      expect(append.mock.invocationCallOrder[0]).toBeLessThan(
        ingest.mock.invocationCallOrder[0],
      );
    });

    it("rebuilds every tier over the whole hours the gap touched", async () => {
      sampleTimes = [];
      deviceData.mockResolvedValue([]);
      await service.fillGaps();
      expect(
        build.mock.calls.map(
          ([tier, from, to]) => `${tier.name} ${iso(from)}..${iso(to)}`,
        ),
      ).toEqual([
        "1m 2026-09-27T21:00:00.000Z..2026-09-29T20:00:00.000Z",
        "5m 2026-09-27T21:00:00.000Z..2026-09-29T20:00:00.000Z",
      ]);
    });

    it("stops paging when Ambient repeats itself", async () => {
      sampleTimes = [];
      const same = page(at("2026-09-29T19:45:00Z"), 3);
      deviceData.mockResolvedValue(same);
      await service.fillGaps();
      // The second page's oldest is not before its end date: stop.
      expect(deviceData).toHaveBeenCalledTimes(2);
    });
  });

  describe("an admin's range", () => {
    it("fetches whole UTC days, oldest first, each then rolled up", async () => {
      deviceData.mockResolvedValue([]);
      await service.backfill({
        from: at("2026-09-01T00:00:00Z"),
        to: at("2026-09-03T00:00:00Z"),
      });
      expect(
        deviceData.mock.calls.map(([, end]) => iso(end as Moment)),
      ).toEqual([
        "2026-09-02T00:00:00.000Z",
        "2026-09-03T00:00:00.000Z",
        "2026-09-04T00:00:00.000Z",
      ]);
      expect(build.mock.calls[0][1].toISOString()).toBe(
        "2026-09-01T00:00:00.000Z",
      );
    });

    it("is refused where backfill is off, or without the keys", async () => {
      const range = {
        from: at("2026-09-01T00:00:00Z"),
        to: at("2026-09-01T00:00:00Z"),
      };
      await expect(make(false).start(range)).rejects.toBeInstanceOf(
        ConflictException,
      );
      configured = false;
      await expect(make(true).start(range)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("runs one at a time", async () => {
      let release: () => void = () => undefined;
      deviceData.mockImplementation(
        () =>
          new Promise((resolve) => {
            release = () => resolve([]);
          }),
      );
      const range = {
        from: at("2026-09-01T00:00:00Z"),
        to: at("2026-09-01T00:00:00Z"),
      };
      await service.start(range);
      expect(service.running).toBe(true);
      await expect(service.start(range)).rejects.toBeInstanceOf(
        ConflictException,
      );
      release();
      await vi.waitFor(() => expect(service.running).toBe(false));
    });
  });
});

describe("toBackfillRequest", () => {
  it("reads a range", () => {
    const request = toBackfillRequest({
      from: "2026-09-01",
      to: "2026-09-02",
      stationId: "3b6f1d2c-0000-4000-8000-000000000001",
    });
    expect(request.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(request.stationId).toBe("3b6f1d2c-0000-4000-8000-000000000001");
  });

  it.each([
    [undefined],
    [{ from: "2026-09-02", to: "2026-09-01" }],
    [{ from: "soon", to: "2026-09-01" }],
    [{ from: "2026-09-01", to: "2026-09-01", stationId: "nope" }],
  ])("refuses %j", (backfill) => {
    expect(() => toBackfillRequest(backfill as never)).toThrow(
      BadRequestException,
    );
  });
});
