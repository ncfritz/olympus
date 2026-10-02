import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  addDays,
  checkTimezone,
  daysBetween,
  isIsoDate,
  isMonday,
  isoWeekBounds,
  isoWeekOf,
  localDateOf,
  todayIn,
} from "../../../../../src/minerva/goals/utils/localDates";

describe("localDates", () => {
  it("takes today in the caller's timezone, not the server's", () => {
    // 18:00 on Oct 1 in Seattle is already Oct 2 in UTC.
    const now = new Date("2026-10-02T01:00:00Z");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-10-01");
    expect(todayIn("Etc/UTC", now)).toBe("2026-10-02");
    expect(todayIn("Pacific/Kiritimati", now)).toBe("2026-10-02");
  });

  it("refuses a timezone it does not know", () => {
    expect(checkTimezone("Europe/London")).toBe("Europe/London");
    expect(() => checkTimezone("Mars/Olympus_Mons")).toThrow(
      BadRequestException,
    );
  });

  it.each([
    ["2026-10-01", true],
    ["2026-02-29", false],
    ["2028-02-29", true],
    ["2026-13-01", false],
    ["2026-10-1", false],
    ["2026-10-01T00:00:00Z", false],
    [20261001, false],
    [undefined, false],
  ])("isIsoDate(%s) is %s", (value, expected) => {
    expect(isIsoDate(value)).toBe(expected);
  });

  it("counts and moves whole days across a daylight saving change", () => {
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-11-02", "2026-10-31")).toBe(-2);
  });

  it("knows a Monday", () => {
    expect(isMonday("2026-09-07")).toBe(true);
    expect(isMonday("2026-09-08")).toBe(false);
  });

  it("dates a moment by the caller's day", () => {
    expect(localDateOf("2026-10-02T01:00:00Z", "America/Los_Angeles")).toBe(
      "2026-10-01",
    );
    expect(localDateOf("2026-10-02T01:00:00Z", "Etc/UTC")).toBe("2026-10-02");
  });

  it.each([
    ["2026-W40", "2026-09-28", "2026-10-04"],
    ["2026-W01", "2025-12-29", "2026-01-04"],
    ["2026-W53", "2026-12-28", "2027-01-03"],
    ["2020-W53", "2020-12-28", "2021-01-03"],
  ])("reads ISO week %s as %s to %s", (week, from, to) => {
    expect(isoWeekBounds(week)).toEqual({ from, to });
  });

  it.each(["2027-W53", "2026-W00", "2026-W54", "2026-40", "W40", 40])(
    "refuses %j as an ISO week",
    (week) => {
      expect(isoWeekBounds(week)).toBeUndefined();
    },
  );

  it.each([
    ["2026-10-01", "2026-W40"],
    ["2026-10-04", "2026-W40"],
    ["2026-10-05", "2026-W41"],
    ["2027-01-01", "2026-W53"],
  ])("puts %s in %s", (date, week) => {
    expect(isoWeekOf(date)).toBe(week);
  });
});
