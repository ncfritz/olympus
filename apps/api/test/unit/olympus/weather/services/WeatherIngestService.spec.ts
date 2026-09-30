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
    expect(request.mock.calls[0][1].updateColumns).toEqual([]);
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

  it("keeps backfill responses for phase 7, without storing them", async () => {
    const { counts } = await service.ingest([
      {
        macAddress: WEATHER_STATION_MAC,
        line: {
          receivedAt: "2026-09-29T20:00:00Z",
          source: "backfill",
          response: [],
        },
      },
    ]);
    expect(counts.skipped).toBe(1);
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

  describe("replacing", () => {
    it("overwrites every reading, clearing any the parser no longer reads", async () => {
      await service.ingest(
        [{ macAddress: WEATHER_STATION_MAC, line: push({ uv: "" }) }],
        "replace",
      );
      const [row] = objects();
      expect(row.uvIndex).toBeNull();
      expect(row.outdoorTemperatureF).toBe(58.1);
      const updateColumns = request.mock.calls[0][1].updateColumns as string[];
      expect(updateColumns).toEqual(
        expect.arrayContaining([
          "outdoorTemperatureF",
          "uvIndex",
          "batteryIndoorOk",
          "receivedTime",
          "source",
        ]),
      );
      expect(updateColumns).not.toContain("stationId");
      expect(updateColumns).not.toContain("observedTime");
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
  ])("refuses %s", (_case, records) => {
    expect(() => toIngestLines(records)).toThrow(BadRequestException);
  });
});
