import moment from "moment";
import { describe, expect, it } from "vitest";
import { toDomainObject } from "../../../../../src/olympus/weather/converters/WeatherStationConverter";
import { graphQlWeatherStation } from "../../../../fixtures/olympus";

const NOW = moment.utc("2026-09-29T20:10:00Z");
const context = { now: NOW, staleSeconds: 600 };

const sample = (
  observedTime: string,
  values: Record<string, unknown> = {},
) => ({
  observedTime,
  source: "push",
  outdoorTemperatureF: 58.1,
  uvIndex: null,
  batteryOutdoorOk: true,
  ...values,
});

describe("WeatherStationConverter", () => {
  it("gives the newest reading, leaving out what the console did not send", () => {
    const station = toDomainObject(
      graphQlWeatherStation({
        samples: [sample("2026-09-29T20:09:44Z")],
      } as never),
      context,
    );
    expect(station.latestReading).toMatchObject({
      source: "push",
      outdoorTemperatureF: 58.1,
      batteryOutdoorOk: true,
    });
    expect(station.latestReading?.observedTime.toISOString()).toBe(
      "2026-09-29T20:09:44.000Z",
    );
    expect(station.latestReading).not.toHaveProperty("uvIndex");
    expect(station.macAddress).toBe("A0:B1:C2:D3:E4:F5");
  });

  it.each([
    ["a reading 16 seconds old", "2026-09-29T20:09:44Z", true],
    ["one exactly ten minutes old", "2026-09-29T20:00:00Z", true],
    ["one older than ten minutes", "2026-09-29T19:59:59Z", false],
  ])("is reporting with %s: %s", (_case, observedTime, reporting) => {
    expect(
      toDomainObject(
        graphQlWeatherStation({ samples: [sample(observedTime)] } as never),
        context,
      ).reporting,
    ).toBe(reporting);
  });

  it("is not reporting with no reading at all", () => {
    const station = toDomainObject(
      graphQlWeatherStation({ samples: [] } as never),
      context,
    );
    expect(station.reporting).toBe(false);
    expect(station.latestReading).toBeUndefined();
  });

  it("says nothing about reporting when the query did not ask", () => {
    const station = toDomainObject(graphQlWeatherStation(), context);
    expect(station).not.toHaveProperty("reporting");
    expect(station).not.toHaveProperty("latestReading");
  });

  it("marks a backfilled reading", () => {
    expect(
      toDomainObject(
        graphQlWeatherStation({
          samples: [sample("2026-09-29T20:05:00Z", { source: "backfill" })],
        } as never),
        context,
      ).latestReading?.source,
    ).toBe("backfill");
  });
});
