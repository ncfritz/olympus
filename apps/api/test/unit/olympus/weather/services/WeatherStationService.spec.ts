import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ClientError } from "graphql-request";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeatherStationService } from "../../../../../src/olympus/weather/services/WeatherStationService";
import {
  graphQlWeatherStation,
  WEATHER_STATION_ID,
  WEATHER_STATION_MAC,
} from "../../../../fixtures/olympus";

const operation = (document: unknown) =>
  /\b(?:query|mutation)\s+(\w+)/.exec(String(document))?.[1];

describe("WeatherStationService", () => {
  let request: ReturnType<typeof vi.fn>;
  let service: WeatherStationService;

  beforeEach(() => {
    vi.useRealTimers();
    request = vi.fn(async (document: unknown) => {
      switch (operation(document)) {
        case "GetWeatherStationByMac":
          return { olympus_weather_stations: [graphQlWeatherStation()] };
        case "CreateWeatherStation":
          return {
            insert_olympus_weather_stations_one: graphQlWeatherStation(),
          };
        case "UpdateWeatherStation":
          return {
            update_olympus_weather_stations_by_pk: graphQlWeatherStation({
              name: "Renamed",
            }),
          };
        default:
          throw new Error(`unexpected ${operation(document)}`);
      }
    });
    service = new WeatherStationService(
      { request } as never,
      {
        stations: { staleSeconds: 600 },
      } as never,
    );
  });

  const lookups = () =>
    request.mock.calls.filter(
      ([document]) => operation(document) === "GetWeatherStationByMac",
    ).length;

  it("gives the MAC in upper case, as the API writes it everywhere", async () => {
    const station = await service.findByMac(WEATHER_STATION_MAC);
    expect(station?.macAddress).toBe(WEATHER_STATION_MAC);
  });

  it("looks a MAC up once a minute, not once a push", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T20:00:00Z"));
    await service.findByMac(WEATHER_STATION_MAC);
    vi.setSystemTime(new Date("2026-09-29T20:00:59Z"));
    await service.findByMac(WEATHER_STATION_MAC);
    expect(lookups()).toBe(1);
    vi.setSystemTime(new Date("2026-09-29T20:01:01Z"));
    await service.findByMac(WEATHER_STATION_MAC);
    expect(lookups()).toBe(2);
    vi.useRealTimers();
  });

  it("forgets the lookups when a station changes", async () => {
    await service.findByMac(WEATHER_STATION_MAC);
    await service.update(WEATHER_STATION_ID, { name: "Renamed" });
    await service.findByMac(WEATHER_STATION_MAC);
    expect(lookups()).toBe(2);
  });

  it("stores the MAC normalised and the name trimmed", async () => {
    await service.create({
      name: "  Mill Creek ",
      macAddress: "a0-b1-c2-d3-e4-f5",
    });
    expect(request.mock.calls[0][1]).toEqual({
      object: { name: "Mill Creek", macAddress: WEATHER_STATION_MAC },
    });
  });

  it.each([
    [undefined],
    [{ name: "", macAddress: WEATHER_STATION_MAC }],
    [{ name: "x".repeat(101), macAddress: WEATHER_STATION_MAC }],
    [{ name: "Mill Creek", macAddress: "not-a-mac" }],
    [{ name: "Mill Creek" }],
  ])("refuses %j", async (body) => {
    await expect(service.create(body as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("answers 409 for a MAC already registered", async () => {
    request.mockRejectedValue(
      new ClientError(
        {
          status: 200,
          errors: [
            {
              message: "Uniqueness violation",
              extensions: { code: "constraint-violation" },
            },
          ],
        } as never,
        { query: "" },
      ),
    );
    await expect(
      service.create({ name: "Mill Creek", macAddress: WEATHER_STATION_MAC }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("changes nothing when there is nothing to change", async () => {
    await expect(
      service.update(WEATHER_STATION_ID, {}),
    ).resolves.toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });

  it("answers 404 when updating a station that is not there", async () => {
    request.mockResolvedValue({ update_olympus_weather_stations_by_pk: null });
    await expect(
      service.update(WEATHER_STATION_ID, { name: "Renamed" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
