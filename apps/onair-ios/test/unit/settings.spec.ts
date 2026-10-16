import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  longTime,
  minutesOf,
  parseSettings,
  shortTime,
  timeToday,
  validHours,
  workingDayQuery,
} from "../../src/settings";

describe("settings", () => {
  it("defaults to 8 to 6 with weekends free", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      dayStart: 480,
      dayEnd: 1080,
      weekendsFree: true,
      hiddenCalendars: [],
    });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("reads what was stored, and falls back where it is not right", () => {
    expect(
      parseSettings(
        JSON.stringify({
          dayStart: 540,
          dayEnd: 990,
          weekendsFree: false,
          hiddenCalendars: ["holidays", 7],
        }),
      ),
    ).toEqual({
      dayStart: 540,
      dayEnd: 990,
      weekendsFree: false,
      hiddenCalendars: ["holidays"],
    });
    expect(
      parseSettings(JSON.stringify({ dayStart: 600, dayEnd: 540 })),
    ).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("asks the API for the working day", () => {
    expect(
      workingDayQuery({ ...DEFAULT_SETTINGS, dayStart: 510, dayEnd: 1050 }),
    ).toEqual({ dayStart: "08:30", dayEnd: "17:30", includeWeekends: false });
    expect(
      workingDayQuery({ ...DEFAULT_SETTINGS, weekendsFree: false })
        .includeWeekends,
    ).toBe(true);
  });

  it("checks hours and writes times", () => {
    expect(validHours(480, 1080)).toBe(true);
    expect(validHours(1080, 480)).toBe(false);
    expect(validHours(480, 480)).toBe(false);
    expect(shortTime(480)).toBe("8a");
    expect(shortTime(750)).toBe("12:30p");
    expect(longTime(1080)).toBe("6:00 PM");
    expect(minutesOf(timeToday(555))).toBe(555);
  });
});
