import { parse } from "node:querystring";
import moment from "moment";
import { describe, expect, it } from "vitest";
import {
  AmbientReportError,
  normalizeMac,
  parseAmbientReport,
} from "../../../../../src/olympus/weather/stations/ambientReport";
import { ambientPush } from "../../../../fixtures/olympus";

const RECEIVED = moment.utc("2026-09-29T20:00:03Z");

/** The query as Express's parser leaves it: `+` is a space, `%3A` a colon. */
const query = (overrides: Record<string, string> = {}) =>
  parse(ambientPush(overrides)) as Record<string, unknown>;

describe("parseAmbientReport", () => {
  it("reads a WS-5000 push into the sample's columns", () => {
    const report = parseAmbientReport(query(), RECEIVED);

    expect(report.macAddress).toBe("A0:B1:C2:D3:E4:F5");
    expect(report.observedAt.toISOString()).toBe("2026-09-29T19:59:44.000Z");
    expect(report.readings).toEqual({
      outdoorTemperatureF: 58.1,
      outdoorHumidityPct: 87,
      indoorTemperatureF: 70.3,
      indoorHumidityPct: 45,
      dewPointF: 54.2,
      feelsLikeF: 58.1,
      windSpeedMph: 3.1,
      windSpeedAvg10mMph: 2.7,
      windGustMph: 4.5,
      maxDailyGustMph: 9.2,
      windDirectionDeg: 202,
      windDirectionAvg10mDeg: 198,
      rainRateInHr: 0,
      rainEventIn: 0,
      rainDailyIn: 0,
      rainWeeklyIn: 0.12,
      rainMonthlyIn: 1.05,
      rainYearlyIn: 21.3,
      pressureRelativeInhg: 29.94,
      pressureAbsoluteInhg: 29.51,
      uvIndex: 2,
      solarRadiationWm2: 312.4,
      batteryOutdoorOk: true,
      batteryIndoorOk: true,
    });
  });

  it("lists parameters it does not know, and ignores the ones it means to", () => {
    const report = parseAmbientReport(query(), RECEIVED);
    expect(report.unknown).toEqual(["battrain"]);
  });

  it("keeps the console's dew point and feels-like when it sends them", () => {
    const report = parseAmbientReport(
      query({ dewPoint: "50.0", feelsLike: "57.0" }),
      RECEIVED,
    );
    expect(report.readings.dewPointF).toBe(50);
    expect(report.readings.feelsLikeF).toBe(57);
  });

  it("takes the older dewptf name when dewPoint is absent", () => {
    const report = parseAmbientReport(query({ dewptf: "49.5" }), RECEIVED);
    expect(report.readings.dewPointF).toBe(49.5);
  });

  it("uses the receipt time for dateutc=now", () => {
    const report = parseAmbientReport(query({ dateutc: "now" }), RECEIVED);
    expect(report.observedAt.toISOString()).toBe(RECEIVED.toISOString());
  });

  it("treats -9999, blanks and junk as no reading", () => {
    const report = parseAmbientReport(
      query({ tempinf: "-9999", humidityin: "", uv: "n/a", battin: "2" }),
      RECEIVED,
    );
    expect(report.readings.indoorTemperatureF).toBeUndefined();
    expect(report.readings.indoorHumidityPct).toBeUndefined();
    expect(report.readings.uvIndex).toBeUndefined();
    expect(report.readings.batteryIndoorOk).toBeUndefined();
  });

  it("reads a low battery as not OK", () => {
    const report = parseAmbientReport(query({ battout: "0" }), RECEIVED);
    expect(report.readings.batteryOutdoorOk).toBe(false);
  });

  it("does not derive a dew point without both temperature and humidity", () => {
    const report = parseAmbientReport(query({ humidity: "" }), RECEIVED);
    expect(report.readings.dewPointF).toBeUndefined();
    expect(report.readings.feelsLikeF).toBe(58.1);
  });

  it("takes the first of a repeated parameter", () => {
    const report = parseAmbientReport(
      { ...query(), tempf: ["58.1", "99"] },
      RECEIVED,
    );
    expect(report.readings.outdoorTemperatureF).toBe(58.1);
  });

  it.each([
    ["no PASSKEY", { PASSKEY: "" }, /PASSKEY/],
    ["a PASSKEY that is not a MAC", { PASSKEY: "abc123" }, /PASSKEY/],
    ["no dateutc", { dateutc: "" }, /dateutc/],
    ["a dateutc that is not a time", { dateutc: "yesterday" }, /dateutc/],
  ])("refuses %s", (_case, overrides, message) => {
    expect(() => parseAmbientReport(query(overrides), RECEIVED)).toThrow(
      AmbientReportError,
    );
    expect(() => parseAmbientReport(query(overrides), RECEIVED)).toThrow(
      message,
    );
  });
});

describe("normalizeMac", () => {
  it.each([
    ["a0:b1:c2:d3:e4:f5"],
    ["A0-B1-C2-D3-E4-F5"],
    ["a0b1c2d3e4f5"],
    ["a0b1.c2d3.e4f5"],
  ])("reads %s", (value) => {
    expect(normalizeMac(value)).toBe("A0:B1:C2:D3:E4:F5");
  });

  it.each([[undefined], [""], ["a0:b1:c2:d3:e4"], ["g0:b1:c2:d3:e4:f5"]])(
    "refuses %s",
    (value) => {
      expect(normalizeMac(value)).toBeUndefined();
    },
  );
});
