import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  clampHeight,
  DEFAULT_CALENDAR_WIDGET,
  MAX_HEIGHT,
  MIN_HEIGHT,
  parseCalendarWidget,
  weekOf,
} from "../../src/utils/calendarWidget";

describe("parseCalendarWidget", () => {
  it("keeps valid settings", () => {
    expect(
      parseCalendarWidget({ days: 7, collapsed: true, height: 700 }),
    ).toEqual({ days: 7, collapsed: true, height: 700 });
  });

  it("falls back to the defaults for nothing stored", () => {
    expect(parseCalendarWidget(null)).toEqual(DEFAULT_CALENDAR_WIDGET);
    expect(parseCalendarWidget("junk")).toEqual(DEFAULT_CALENDAR_WIDGET);
  });

  it("replaces each invalid setting on its own", () => {
    expect(
      parseCalendarWidget({ days: 6, collapsed: true, height: "tall" }),
    ).toEqual({
      days: DEFAULT_CALENDAR_WIDGET.days,
      collapsed: true,
      height: DEFAULT_CALENDAR_WIDGET.height,
    });
  });

  it("brings a stored height within bounds", () => {
    expect(parseCalendarWidget({ height: 10 }).height).toBe(MIN_HEIGHT);
    expect(parseCalendarWidget({ height: 99999 }).height).toBe(MAX_HEIGHT);
  });
});

describe("clampHeight", () => {
  it("rounds to whole pixels within the bounds", () => {
    expect(clampHeight(400.6)).toBe(401);
    expect(clampHeight(-5)).toBe(MIN_HEIGHT);
    expect(clampHeight(MAX_HEIGHT + 1)).toBe(MAX_HEIGHT);
  });
});

describe("weekOf", () => {
  const wednesday = DateTime.fromISO("2026-10-07T15:00:00");

  it("is Monday to Friday, or to Sunday", () => {
    const five = weekOf(wednesday, 5);
    expect(five.start.toISODate()).toBe("2026-10-05");
    expect(five.end.toISODate()).toBe("2026-10-10");
    expect(five.label).toBe("Oct 5 – 9");

    const seven = weekOf(wednesday, 7);
    expect(seven.end.toISODate()).toBe("2026-10-12");
    expect(seven.label).toBe("Oct 5 – 11");
  });

  it("names both months when the week crosses one", () => {
    expect(weekOf(DateTime.fromISO("2026-09-30"), 7).label).toBe(
      "Sep 28 – Oct 4",
    );
    expect(weekOf(DateTime.fromISO("2026-09-30"), 5).label).toBe(
      "Sep 28 – Oct 2",
    );
  });

  it("starts a Sunday's week on the Monday before", () => {
    expect(weekOf(DateTime.fromISO("2026-10-11"), 7).start.toISODate()).toBe(
      "2026-10-05",
    );
  });
});
