import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  addDays,
  checkTimezone,
  daysBetween,
  isIsoDate,
  isMonday,
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
});
