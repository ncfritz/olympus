import { describe, expect, it } from "vitest";
import { recordToQuery } from "../../../../../src/olympus/weather/stations/ambientRecord";

const MAC = "A0:B1:C2:D3:E4:F5";

describe("recordToQuery", () => {
  it("reads a record as the upload's query", () => {
    expect(
      recordToQuery(MAC, {
        dateutc: Date.parse("2026-09-29T20:05:00Z"),
        date: "2026-09-29T20:05:00.000Z",
        tempf: 57.9,
        humidity: 81,
        battout: 1,
        lastRain: "2026-09-28T03:00:00.000Z",
        feelsLike: null,
        nested: { x: 1 },
      }),
    ).toEqual({
      PASSKEY: MAC,
      dateutc: "2026-09-29 20:05:00",
      date: "2026-09-29T20:05:00.000Z",
      tempf: "57.9",
      humidity: "81",
      battout: "1",
      lastRain: "2026-09-28T03:00:00.000Z",
    });
  });

  it("takes an ISO dateutc too", () => {
    expect(
      recordToQuery(MAC, { dateutc: "2026-09-29T20:05:00.000Z" })?.dateutc,
    ).toBe("2026-09-29 20:05:00");
  });

  it.each([
    [undefined],
    [null],
    ["text"],
    [[1, 2]],
    [{ tempf: 50 }],
    [{ dateutc: "yesterday" }],
    [{ dateutc: Number.NaN }],
  ])("has nothing for %j", (record) => {
    expect(recordToQuery(MAC, record)).toBeUndefined();
  });
});
