import moment from "moment";
import { describe, expect, it } from "vitest";
import { dailyIndex, emptyDailySeries } from "./dailySeries";

const today = moment.utc("2026-09-18T00:00:00Z");
const day = (iso: string) => moment.utc(iso).valueOf();

describe("emptyDailySeries", () => {
  it("has one zero point per day, ending today", () => {
    const series = emptyDailySeries(today);
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual([day("2026-08-20"), 0]);
    expect(series[29]).toEqual([day("2026-09-18"), 0]);
  });

  it("returns independent points", () => {
    const series = emptyDailySeries(today, 3);
    series[0][1] = 5;
    expect(series[1][1]).toBe(0);
  });

  it("does not move the given day", () => {
    emptyDailySeries(today);
    expect(today.toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });
});

describe("dailyIndex", () => {
  it.each([
    ["2026-09-18", 29],
    ["2026-09-18T23:59:00Z", 29],
    ["2026-09-17T23:59:00Z", 28],
    ["2026-08-20", 0],
    ["2026-08-19", undefined],
    ["2026-09-19", undefined],
  ])("places %s at %s", (iso, index) => {
    expect(dailyIndex(today, moment.utc(iso))).toBe(index);
  });
});
