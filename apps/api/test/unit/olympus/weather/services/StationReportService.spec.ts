import { parse } from "node:querystring";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import { StationReportService } from "../../../../../src/olympus/weather/services/StationReportService";
import {
  ambientPush,
  WEATHER_STATION_ID,
  WEATHER_STATION_MAC,
} from "../../../../fixtures/olympus";

const STATION = { id: WEATHER_STATION_ID, name: "Mill Creek" };

describe("StationReportService", () => {
  let request: ReturnType<typeof vi.fn>;
  let findByMac: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let service: StationReportService;

  const push = (
    remoteAddress: string | undefined,
    overrides: Record<string, string> = {},
  ) => {
    const rawQuery = ambientPush(overrides);
    return {
      query: parse(rawQuery) as Record<string, unknown>,
      rawQuery,
      remoteAddress,
    };
  };

  beforeEach(() => {
    request = vi.fn().mockResolvedValue({
      insert_olympus_weather_station_samples_one: { id: 1 },
    });
    findByMac = vi.fn(async (mac: string) =>
      mac === WEATHER_STATION_MAC ? STATION : undefined,
    );
    append = vi.fn().mockResolvedValue(true);
    service = new StationReportService(
      { request } as never,
      { findByMac } as never,
      { append } as never,
      {
        stations: {
          allowedCidrs: ["192.168.15.0/24", "192.168.0.0/24", "10.9.8.7"],
        },
      } as WeatherConfigType,
    );
  });

  it("archives the push as received, then stores it", async () => {
    const received = push("192.168.15.20");
    await expect(service.report(received)).resolves.toBe("stored");

    expect(append).toHaveBeenCalledWith(
      WEATHER_STATION_MAC,
      expect.objectContaining({
        source: "push",
        remote: "192.168.15.20",
        query: received.rawQuery,
      }),
    );
    const { object } = request.mock.calls[0][1];
    expect(object).toMatchObject({
      stationId: WEATHER_STATION_ID,
      observedTime: "2026-09-29T19:59:44.000Z",
      source: "push",
      outdoorTemperatureF: 58.1,
      indoorHumidityPct: 45,
    });
    expect(append.mock.invocationCallOrder[0]).toBeLessThan(
      request.mock.invocationCallOrder[0],
    );
  });

  it("calls a reading already stored a duplicate", async () => {
    request.mockResolvedValue({
      insert_olympus_weather_station_samples_one: null,
    });
    await expect(service.report(push("192.168.15.20"))).resolves.toBe(
      "duplicate",
    );
  });

  it.each([
    ["the second station's range", "192.168.0.44"],
    ["a single allowed address", "10.9.8.7"],
    ["an IPv4-mapped peer", "::ffff:192.168.15.20"],
  ])("accepts %s", async (_case, address) => {
    await expect(service.report(push(address))).resolves.toBe("stored");
  });

  it.each([
    ["an address outside the ranges", "192.168.16.20"],
    ["an IPv6 peer", "fe80::1"],
    ["no address", undefined],
  ])("refuses %s, before looking anything up", async (_case, address) => {
    await expect(service.report(push(address))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findByMac).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it("refuses an unregistered console without archiving it", async () => {
    await expect(
      service.report(
        push("192.168.15.20", {
          PASSKEY: "0A:1B:2C:3D:4E:5F",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(append).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("finds the station by MAC however the console spells it", async () => {
    await service.report(push("192.168.15.20", { PASSKEY: "a0b1c2d3e4f5" }));
    expect(findByMac).toHaveBeenCalledWith(WEATHER_STATION_MAC);
  });

  it("archives a push it cannot parse, then answers 400", async () => {
    await expect(
      service.report(push("192.168.15.20", { dateutc: "yesterday" })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(append).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it("still stores the sample when the archive fails", async () => {
    append.mockResolvedValue(false);
    await expect(service.report(push("192.168.15.20"))).resolves.toBe("stored");
  });
});
