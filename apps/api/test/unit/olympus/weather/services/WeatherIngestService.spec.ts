import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  toIngestLines,
  WeatherIngestService,
} from "../../../../../src/olympus/weather/services/WeatherIngestService";
import type { ArchiveLine } from "../../../../../src/olympus/weather/stations/StationArchive";
import {
  ambientPush,
  WEATHER_STATION_ID,
  WEATHER_STATION_MAC,
} from "../../../../fixtures/olympus";

const OTHER_MAC = "0A:1B:2C:3D:4E:5F";

const push = (
  overrides: Record<string, string> = {},
  receivedAt = "2026-09-29T20:00:03.000Z",
): ArchiveLine => ({
  receivedAt,
  source: "push",
  remote: "192.168.15.20",
  query: ambientPush(overrides),
});

describe("WeatherIngestService", () => {
  let request: ReturnType<typeof vi.fn>;
  let findByMac: ReturnType<typeof vi.fn>;
  let service: WeatherIngestService;

  const objects = () =>
    request.mock.calls[0][1].objects as Record<string, unknown>[];

  beforeEach(() => {
    request = vi.fn(
      async (_document: unknown, variables: { objects: unknown[] }) => ({
        insert_olympus_weather_station_samples: {
          affected_rows: variables.objects.length,
        },
      }),
    );
    findByMac = vi.fn(async (mac: string) =>
      mac === WEATHER_STATION_MAC ? { id: WEATHER_STATION_ID } : undefined,
    );
    service = new WeatherIngestService(
      { request } as never,
      { findByMac } as never,
    );
  });

  it("parses each line with this environment's parser and stores it", async () => {
    const { counts } = await service.ingest([
      { macAddress: WEATHER_STATION_MAC, line: push() },
    ]);

    expect(counts).toEqual({
      stored: 1,
      duplicate: 0,
      unknown_station: 0,
      invalid: 0,
      skipped: 0,
    });
    expect(objects()[0]).toMatchObject({
      stationId: WEATHER_STATION_ID,
      observedTime: "2026-09-29T19:59:44.000Z",
      receivedTime: "2026-09-29T20:00:03.000Z",
      source: "push",
      outdoorTemperatureF: 58.1,
    });
    // A push replaces only a backfilled reading of the same moment.
    expect(request.mock.calls[0][1].onConflict).toMatchObject({
      constraint: "weather_station_samples_station_id_observed_at_key",
      where: { source: { _eq: "backfill" } },
    });
  });

  it("stores a batch in one request", async () => {
    await service.ingest([
      { macAddress: WEATHER_STATION_MAC, line: push() },
      {
        macAddress: WEATHER_STATION_MAC,
        line: push({ dateutc: "2026-09-29+20:00:00" }),
      },
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(objects()).toHaveLength(2);
  });

  it("counts what the database already had as duplicates", async () => {
    request.mockResolvedValue({
      insert_olympus_weather_station_samples: { affected_rows: 1 },
    });
    const { counts } = await service.ingest([
      { macAddress: WEATHER_STATION_MAC, line: push() },
      {
        macAddress: WEATHER_STATION_MAC,
        line: push({ dateutc: "2026-09-29+20:00:00" }),
      },
    ]);
    expect(counts.stored).toBe(1);
    expect(counts.duplicate).toBe(1);
  });

  it("inserts a reading repeated within a batch once, as its last copy", async () => {
    const { counts } = await service.ingest([
      { macAddress: WEATHER_STATION_MAC, line: push({ tempf: "50" }) },
      { macAddress: WEATHER_STATION_MAC, line: push({ tempf: "51" }) },
    ]);
    expect(objects()).toHaveLength(1);
    expect(objects()[0].outdoorTemperatureF).toBe(51);
    expect(counts).toMatchObject({ stored: 1, duplicate: 1 });
  });

  it("skips a station this environment does not know", async () => {
    const { counts } = await service.ingest([
      { macAddress: OTHER_MAC, line: push({ PASSKEY: OTHER_MAC }) },
    ]);
    expect(counts.unknown_station).toBe(1);
    expect(request).not.toHaveBeenCalled();
  });

  it("counts a line that does not parse, with the reason", async () => {
    const { counts, errors } = await service.ingest([
      { macAddress: WEATHER_STATION_MAC, line: push({ dateutc: "soon" }) },
      {
        macAddress: WEATHER_STATION_MAC,
        line: { ...push(), receivedAt: "not a time" },
      },
    ]);
    expect(counts.invalid).toBe(2);
    expect(errors).toEqual([
      "dateutc is not a time",
      "receivedAt is not a time",
    ]);
    expect(request).not.toHaveBeenCalled();
  });

  it("reads a query archived with its leading ?", async () => {
    const line = push();
    const { counts } = await service.ingest([
      {
        macAddress: WEATHER_STATION_MAC,
        line: { ...line, query: `?${line.query}` },
      },
    ]);
    expect(counts.stored).toBe(1);
  });

  describe("what a reading already stored becomes", () => {
    const backfill = (records: unknown[]): ArchiveLine => ({
      receivedAt: "2026-09-29T21:00:00.000Z",
      source: "backfill",
      response: records,
    });
    const RECORD = { dateutc: 1790712000000, tempf: 57.5, humidity: 80 };

    const onConflict = () =>
      request.mock.calls[0][1].onConflict as {
        update_columns: string[];
        where?: unknown;
      };

    it.each([
      ["a push, ignoring", "push", "ignore", true, true],
      ["a push, replacing", "push", "replace", true, false],
      ["a backfill, ignoring", "backfill", "ignore", false, false],
      ["a backfill, replacing", "backfill", "replace", true, true],
    ] as const)(
      "%s: updates %s, only over a backfilled one %s",
      async (_case, source, mode, updates, onlyOverBackfill) => {
        await service.ingest(
          [
            {
              macAddress: WEATHER_STATION_MAC,
              line: source === "push" ? push({ uv: "" }) : backfill([RECORD]),
            },
          ],
          mode,
        );
        const conflict = onConflict();
        expect(conflict.update_columns.length > 0).toBe(updates);
        expect(conflict.where !== undefined).toBe(onlyOverBackfill);
        if (updates) {
          expect(conflict.update_columns).toEqual(
            expect.arrayContaining([
              "outdoorTemperatureF",
              "uvIndex",
              "batteryIndoorOk",
              "receivedTime",
              "source",
            ]),
          );
          expect(conflict.update_columns).not.toContain("stationId");
          expect(conflict.update_columns).not.toContain("observedTime");
          // Whatever it does not have becomes null, not the old value.
          expect(objects()[0].uvIndex).toBeNull();
        }
      },
    );
  });

  describe("backfill lines", () => {
    const backfill = (response: unknown): ArchiveLine => ({
      receivedAt: "2026-09-29T21:00:00.000Z",
      source: "backfill",
      response,
    });

    it("stores each record of the response as a backfilled sample", async () => {
      const { counts } = await service.ingest([
        {
          macAddress: WEATHER_STATION_MAC,
          line: backfill([
            { dateutc: 1790712300000, tempf: 57.9, humidity: 81, battout: 1 },
            { dateutc: 1790712000000, tempf: 57.5, humidity: 80 },
          ]),
        },
      ]);
      expect(counts).toMatchObject({ stored: 2, invalid: 0 });
      expect(
        objects().map((o) => [o.observedTime, o.source, o.outdoorTemperatureF]),
      ).toEqual([
        ["2026-09-29T20:05:00.000Z", "backfill", 57.9],
        ["2026-09-29T20:00:00.000Z", "backfill", 57.5],
      ]);
      expect(objects()[0]).toMatchObject({
        stationId: WEATHER_STATION_ID,
        receivedTime: "2026-09-29T21:00:00.000Z",
        batteryOutdoorOk: true,
      });
    });

    it("counts a record with no usable time, and stores the rest", async () => {
      const { counts, errors } = await service.ingest([
        {
          macAddress: WEATHER_STATION_MAC,
          line: backfill([
            { tempf: 50 },
            "junk",
            { dateutc: 1790712000000, tempf: 57.5 },
          ]),
        },
      ]);
      expect(counts).toMatchObject({ stored: 1, invalid: 2 });
      expect(errors).toEqual([
        "record has no dateutc",
        "record has no dateutc",
      ]);
    });

    it("counts a line whose response is not a list", async () => {
      const { counts, errors } = await service.ingest([
        { macAddress: WEATHER_STATION_MAC, line: backfill({ error: "x" }) },
      ]);
      expect(counts.invalid).toBe(1);
      expect(errors).toEqual(["response is not a list of records"]);
      expect(request).not.toHaveBeenCalled();
    });

    it("lets a push in the same batch outrank a record of the same moment", async () => {
      const { counts } = await service.ingest([
        {
          macAddress: WEATHER_STATION_MAC,
          line: backfill([
            { dateutc: Date.parse("2026-09-29T19:59:44Z"), tempf: 1 },
          ]),
        },
        { macAddress: WEATHER_STATION_MAC, line: push() },
        {
          macAddress: WEATHER_STATION_MAC,
          line: backfill([
            { dateutc: Date.parse("2026-09-29T19:59:44Z"), tempf: 2 },
          ]),
        },
      ]);
      // One insert, of the push: no backfill rows are left to write.
      expect(request).toHaveBeenCalledTimes(1);
      expect(objects()).toHaveLength(1);
      expect(objects()[0]).toMatchObject({
        source: "push",
        outdoorTemperatureF: 58.1,
      });
      expect(counts).toMatchObject({ stored: 1, duplicate: 2 });
    });
  });
});

describe("toIngestLines", () => {
  const record = (overrides: Record<string, unknown> = {}) => ({
    macAddress: "a0b1c2d3e4f5",
    receivedAt: "2026-09-29T20:00:03.000Z",
    source: "push",
    remote: "192.168.15.20",
    query: "&PASSKEY=A0:B1:C2:D3:E4:F5",
    ...overrides,
  });

  it("reads records as lines, with the MAC normalised", () => {
    expect(toIngestLines([record()])).toEqual([
      {
        macAddress: WEATHER_STATION_MAC,
        line: {
          receivedAt: "2026-09-29T20:00:03.000Z",
          source: "push",
          remote: "192.168.15.20",
          query: "&PASSKEY=A0:B1:C2:D3:E4:F5",
        },
      },
    ]);
  });

  it("takes up to 500", () => {
    expect(
      toIngestLines(Array.from({ length: 500 }, () => record())),
    ).toHaveLength(500);
  });

  it.each([
    ["undefined", undefined],
    ["an object", {}],
    ["an empty list", []],
    ["501 records", Array.from({ length: 501 }, () => record())],
    ["a null record", [null]],
    ["a bad MAC", [record({ macAddress: "nope" })]],
    ["no time", [record({ receivedAt: 5 })]],
    ["an unknown source", [record({ source: "relay" })]],
    ["a remote that is not text", [record({ remote: 1 })]],
    ["a response that is not JSON", [record({ responseJson: "{" })]],
  ])("refuses %s", (_case, records) => {
    expect(() => toIngestLines(records)).toThrow(BadRequestException);
  });
});

describe("toIngestLines, backfill", () => {
  it("reads a relayed backfill response from its JSON", () => {
    const [line] = toIngestLines([
      {
        macAddress: "A0:B1:C2:D3:E4:F5",
        receivedAt: "2026-09-29T21:00:00.000Z",
        source: "backfill",
        responseJson: '[{"dateutc":1790712000000,"tempf":57.5}]',
      },
    ]);
    expect(line.line).toEqual({
      receivedAt: "2026-09-29T21:00:00.000Z",
      source: "backfill",
      remote: undefined,
      query: undefined,
      response: [{ dateutc: 1790712000000, tempf: 57.5 }],
    });
  });
});
