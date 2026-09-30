import { describe, expect, it } from "vitest";
import {
  ago,
  apiErrorMessage,
  lowHigh,
  normalizeMac,
  sparkline,
  stationTiles,
  tenths,
} from "../../src/utils/stations";

const NOW = Date.parse("2026-09-29T20:00:00Z");

describe("ago", () => {
  it.each([
    ["2026-09-29T19:59:48Z", "12 s ago"],
    ["2026-09-29T20:00:05Z", "0 s ago"],
    ["2026-09-29T19:56:00Z", "4 min ago"],
    ["2026-09-29T17:00:00Z", "3 h ago"],
    ["2026-09-26T20:00:00Z", "3 d ago"],
  ])("%s is %s", (iso, text) => {
    expect(ago(iso, NOW)).toBe(text);
  });
});

describe("stationTiles", () => {
  const full = {
    observedTime: "2026-09-29T19:59:44Z",
    source: "push" as const,
    feelsLikeF: 57.04,
    dewPointF: 52.14,
    outdoorHumidityPct: 83,
    windSpeedMph: 4.3,
    windDirectionDeg: 202,
    windGustMph: 7.8,
    pressureRelativeInhg: 29.932,
    rainRateInHr: 0.04,
    rainDailyIn: 0.21,
    uvIndex: 1,
    solarRadiationWm2: 142.4,
    indoorTemperatureF: 70.3,
    indoorHumidityPct: 48,
    batteryOutdoorOk: true,
    batteryIndoorOk: true,
  };

  it("reads a full push in the design's order", () => {
    expect(
      stationTiles(full).map((tile) => `${tile.label}: ${tile.value}`),
    ).toEqual([
      "Feels like: 57.0°",
      "Dew point: 52.1°",
      "Humidity: 83%",
      "Wind: SSW 4.3 mph",
      "Gust: 7.8 mph",
      "Pressure: 29.93 in",
      "Rain rate: 0.04 in/h",
      "Rain today: 0.21 in",
      "UV / solar: 1 · 142 W/m²",
      "Indoor: 70.3°",
      "Indoor humidity: 48%",
      "Battery: OK",
    ]);
  });

  it("shows a dash for what the console did not send", () => {
    const tiles = stationTiles({
      observedTime: full.observedTime,
      source: "backfill",
    });
    expect(tiles).toHaveLength(12);
    expect(tiles.every((tile) => tile.value === "—")).toBe(true);
  });

  it("gives calm wind no direction", () => {
    const wind = stationTiles({ ...full, windSpeedMph: 0 })[3];
    expect(wind.value).toBe("0.0 mph");
  });

  it("names a low battery", () => {
    expect(
      stationTiles({ ...full, batteryOutdoorOk: false }).at(-1)?.value,
    ).toBe("Low: outdoor");
    expect(
      stationTiles({
        ...full,
        batteryOutdoorOk: false,
        batteryIndoorOk: false,
      }).at(-1)?.value,
    ).toBe("Low: outdoor, console");
  });
});

describe("tenths", () => {
  it("reads a temperature to a tenth", () => {
    expect(tenths(57.25)).toBe("57.3°");
    expect(tenths(undefined)).toBe("—");
  });
});

describe("sparkline", () => {
  const from = Date.parse("2026-09-29T00:00:00Z");
  const to = Date.parse("2026-09-29T01:00:00Z");
  const at = (minute: number, value: number) => ({
    time: new Date(from + minute * 60_000).toISOString(),
    value,
  });

  it("places points by time and value, low at the bottom", () => {
    expect(
      sparkline(
        [at(0, 50), at(30, 60), at(60, 55)],
        from,
        to,
        300,
        44,
        1_800_000,
      ),
    ).toEqual(["0,41 150,3 300,22"]);
  });

  it("breaks the line across a gap", () => {
    expect(
      sparkline(
        [at(0, 50), at(15, 55), at(45, 60), at(60, 50)],
        from,
        to,
        300,
        44,
        900_000,
      ),
    ).toEqual(["0,41 75,22", "225,3 300,41"]);
  });

  it("draws a flat series across the middle", () => {
    expect(
      sparkline([at(0, 50), at(60, 50)], from, to, 300, 44, 3_600_000),
    ).toEqual(["0,22 300,22"]);
  });

  it("draws nothing for no points", () => {
    expect(sparkline([], from, to, 300, 44, 900_000)).toEqual([]);
  });
});

describe("lowHigh", () => {
  it("takes the buckets' minimum and maximum", () => {
    expect(
      lowHigh([
        { mean: 55, min: 49.8, max: 57 },
        { mean: 58, min: 56, max: 61 },
      ]),
    ).toEqual({ low: 49.8, high: 61 });
  });

  it("is undefined for no points", () => {
    expect(lowHigh([])).toBeUndefined();
  });
});

describe("normalizeMac", () => {
  it.each([
    ["A0:B1:C2:D3:E4:F5", "A0:B1:C2:D3:E4:F5"],
    ["a0:b1:c2:d3:e4:f5", "A0:B1:C2:D3:E4:F5"],
    ["A0-B1-C2-D3-E4-F5", "A0:B1:C2:D3:E4:F5"],
    ["a0b1.c2d3.e4f5", "A0:B1:C2:D3:E4:F5"],
    [" a0b1c2d3e4f5 ", "A0:B1:C2:D3:E4:F5"],
  ])("reads %s as %s", (input, mac) => {
    expect(normalizeMac(input)).toBe(mac);
  });

  it.each([[undefined], [""], ["A0:B1:C2:D3:E4"], ["G0:B1:C2:D3:E4:F5"]])(
    "refuses %s",
    (input) => {
      expect(normalizeMac(input)).toBeUndefined();
    },
  );
});

describe("apiErrorMessage", () => {
  it("reads the message from an error's body", () => {
    expect(
      apiErrorMessage({
        response: { data: { message: "Already registered", statusCode: 409 } },
      }),
    ).toBe("Already registered");
  });

  it.each([[undefined], [new Error("network")], [{ response: {} }]])(
    "has none for %s",
    (error) => {
      expect(apiErrorMessage(error)).toBeUndefined();
    },
  );
});
