import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  formatMinutes,
  meetingsHref,
  organizerOf,
  periodOf,
  periodStatistics,
  stepPeriod,
} from "../../src/utils/meetings";

const ZONE = "America/Los_Angeles";
const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });

describe("organizerOf", () => {
  it("names a known organizer, with their photo", () => {
    expect(
      organizerOf({
        organizer: {
          email: "lee@example.com",
          alias: "lee",
          givenName: "Lee",
          surname: "Dar",
        },
        organizerEmail: "lee@example.com",
      }),
    ).toEqual({
      name: "Lee Dar",
      email: "lee@example.com",
      avatar: "https://cdn.internal.ncfritz.net/amzn/avatar/lee.jpg",
    });
  });

  it("falls back to the address of a synced meeting's organizer", () => {
    expect(organizerOf({ organizerEmail: "someone@example.com" })).toEqual({
      name: "someone@example.com",
      email: "someone@example.com",
      avatar: undefined,
    });
  });

  it("says so when a meeting names no organizer", () => {
    expect(organizerOf({})).toEqual({
      name: "Unknown organizer",
      email: undefined,
      avatar: undefined,
    });
  });
});

describe("periodOf", () => {
  it("is the day itself for the day view", () => {
    const period = periodOf("day", at("2026-10-04T15:30"));
    expect(period.start.toISO()).toBe(at("2026-10-04").toISO());
    expect(period.days).toBe(1);
  });

  it("is the ISO week, Monday to Sunday, for the week view", () => {
    const period = periodOf("week", at("2026-10-04"));
    expect(period.start.toISODate()).toBe("2026-09-28");
    expect(period.days).toBe(7);
    expect(period.to.toISODate()).toBe("2026-10-05");
  });

  it("is the whole weeks a month touches, in whole days, for the month view", () => {
    // October 2026: Thursday the 1st to Saturday the 31st; summer time
    // ends on Sunday 1 November, the grid's last day.
    const period = periodOf("month", at("2026-10-17"));
    expect(period.start.toISODate()).toBe("2026-09-28");
    expect(period.days).toBe(35);
    expect(Number.isInteger(period.days)).toBe(true);
    expect(period.from.toISODate()).toBe("2026-10-01");
    expect(period.to.toISODate()).toBe("2026-11-01");
  });

  it("fits a month that fills its weeks exactly", () => {
    // February 2027 starts on a Monday and ends on a Sunday.
    expect(periodOf("month", at("2027-02-10")).days).toBe(28);
  });
});

describe("meetingsHref and stepPeriod", () => {
  it("links each view", () => {
    expect(meetingsHref("day", at("2026-10-04"))).toBe(
      "/minerva/meetings/2026/10/04",
    );
    expect(meetingsHref("week", at("2026-10-04"))).toBe(
      "/minerva/meetings/2026/W40",
    );
    expect(meetingsHref("month", at("2026-10-04"))).toBe(
      "/minerva/meetings/2026/10",
    );
  });

  it("names a week by its ISO year", () => {
    expect(meetingsHref("week", at("2026-12-29"))).toBe(
      "/minerva/meetings/2026/W53",
    );
    expect(meetingsHref("week", at("2025-12-30"))).toBe(
      "/minerva/meetings/2026/W01",
    );
  });

  it("steps by the view's period", () => {
    expect(stepPeriod("day", at("2026-10-04"), 1).toISODate()).toBe(
      "2026-10-05",
    );
    expect(stepPeriod("week", at("2026-10-04"), -1).toISODate()).toBe(
      "2026-09-27",
    );
    expect(stepPeriod("month", at("2026-10-31"), 1).toISODate()).toBe(
      "2026-11-01",
    );
  });
});

describe("periodStatistics", () => {
  const meeting = (start: string, end: string, extra = {}) => ({
    startTime: at(start).toISO()!,
    endTime: at(end).toISO()!,
    isAllDay: false,
    isCancelled: false,
    status: "Busy",
    ...extra,
  });
  const day = periodOf("day", at("2026-10-05"));

  it("counts the period's meetings and their time by status", () => {
    const statistics = periodStatistics(
      [
        meeting("2026-10-05T09:00", "2026-10-05T09:30"),
        meeting("2026-10-05T10:00", "2026-10-05T11:00", {
          status: "Tentative",
        }),
        meeting("2026-10-05T12:00", "2026-10-05T12:30", { isCancelled: true }),
        meeting("2026-10-05T00:00", "2026-10-06T00:00", { isAllDay: true }),
      ],
      day.from,
      day.to,
    );
    expect(statistics).toEqual({
      meetings: 2,
      minutes: 90,
      byStatus: { Busy: 1, Tentative: 1 },
      cancelled: 1,
    });
  });

  it("counts only a meeting's minutes inside the period", () => {
    expect(
      periodStatistics(
        [meeting("2026-10-04T23:30", "2026-10-05T00:30")],
        day.from,
        day.to,
      ).minutes,
    ).toBe(30);
  });

  it("leaves out a meeting that ends as the period starts", () => {
    expect(
      periodStatistics(
        [meeting("2026-10-04T23:00", "2026-10-05T00:00")],
        day.from,
        day.to,
      ).meetings,
    ).toBe(0);
  });
});

describe("formatMinutes", () => {
  it.each([
    [0, "0m"],
    [45, "45m"],
    [60, "1h"],
    [90, "1h 30m"],
  ])("%d is %s", (minutes, shown) => {
    expect(formatMinutes(minutes)).toBe(shown);
  });
});
