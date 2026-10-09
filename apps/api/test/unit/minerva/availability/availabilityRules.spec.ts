import { AvailabilityLevel } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  availabilitySlots,
  DEFAULT_WORKING_DAY,
  highest,
  isLevel,
  isTimeZone,
  levelOfMeetingStatus,
  parseTimeOfDay,
  SLOT_MS,
  slotStartOf,
  type Timed,
  type TimedMeeting,
  workingDayTest,
} from "../../../../src/minerva/availability/utils/availabilityRules";

const { None, Free, Interruptable, Busy } = AvailabilityLevel;
const at = (iso: string) => Date.parse(iso);

/** Monday 2026-10-05, in UTC unless a test says otherwise. */
const MONDAY = "2026-10-05";

const meeting = (
  start: string,
  end: string,
  level: AvailabilityLevel,
  overridden = false,
): TimedMeeting => ({
  start: at(`${MONDAY}T${start}:00Z`),
  end: at(`${MONDAY}T${end}:00Z`),
  level,
  overridden,
});

const block = (
  start: string,
  end: string,
  level: AvailabilityLevel,
): Timed => ({
  start: at(`${MONDAY}T${start}:00Z`),
  end: at(`${MONDAY}T${end}:00Z`),
  level,
});

/** The levels of the slots from `start` to `end` (HH:mm, Monday, UTC). */
const levels = (
  start: string,
  end: string,
  meetings: TimedMeeting[] = [],
  blocks: Timed[] = [],
  day = DEFAULT_WORKING_DAY,
) =>
  availabilitySlots(
    at(`${MONDAY}T${start}:00Z`),
    at(`${MONDAY}T${end}:00Z`),
    meetings,
    blocks,
    day,
  ).map((s) => s.level);

describe("levelOfMeetingStatus", () => {
  it.each([
    ["Busy", Busy],
    ["Tentative", Interruptable],
    ["Free", Free],
    ["OOF", None],
    ["WorkingElsewhere", None],
    ["NoData", Busy],
    ["something new", Busy],
  ])("%s counts as %s", (status, level) => {
    expect(levelOfMeetingStatus(status)).toBe(level);
  });
});

describe("highest", () => {
  it("orders none < free < interruptable < busy", () => {
    expect(highest([None, Free])).toBe(Free);
    expect(highest([Free, Interruptable, None])).toBe(Interruptable);
    expect(highest([Interruptable, Busy, Free])).toBe(Busy);
    expect(highest([None])).toBe(None);
  });
});

describe("isLevel", () => {
  it("knows the four levels and nothing else", () => {
    expect([None, Free, Interruptable, Busy].every(isLevel)).toBe(true);
    expect(isLevel("dnd")).toBe(false);
    expect(isLevel(undefined)).toBe(false);
  });
});

describe("parseTimeOfDay", () => {
  it("reads HH:mm as minutes after midnight", () => {
    expect(parseTimeOfDay("08:00")).toBe(480);
    expect(parseTimeOfDay("23:59")).toBe(1439);
    expect(parseTimeOfDay("00:00")).toBe(0);
  });

  it.each(["8:00", "24:00", "12:60", "noon", ""])("refuses %j", (value) => {
    expect(parseTimeOfDay(value)).toBeUndefined();
  });
});

describe("isTimeZone", () => {
  it("knows IANA names", () => {
    expect(isTimeZone("America/Los_Angeles")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});

describe("slotStartOf", () => {
  it("rounds down to the quarter hour", () => {
    expect(slotStartOf(at(`${MONDAY}T09:14:59Z`))).toBe(
      at(`${MONDAY}T09:00:00Z`),
    );
    expect(slotStartOf(at(`${MONDAY}T09:15:00Z`))).toBe(
      at(`${MONDAY}T09:15:00Z`),
    );
  });
});

describe("workingDayTest", () => {
  it("is 08:00 to 18:00 on weekdays by default", () => {
    const working = workingDayTest(DEFAULT_WORKING_DAY);
    expect(working(at(`${MONDAY}T07:45:00Z`))).toBe(false);
    expect(working(at(`${MONDAY}T08:00:00Z`))).toBe(true);
    expect(working(at(`${MONDAY}T17:45:00Z`))).toBe(true);
    expect(working(at(`${MONDAY}T18:00:00Z`))).toBe(false);
    expect(working(at("2026-10-04T12:00:00Z"))).toBe(false); // Sunday
    expect(working(at("2026-10-03T12:00:00Z"))).toBe(false); // Saturday
  });

  it("counts weekends when asked", () => {
    const working = workingDayTest({
      ...DEFAULT_WORKING_DAY,
      includeWeekends: true,
    });
    expect(working(at("2026-10-04T12:00:00Z"))).toBe(true);
  });

  it("reads the day in the caller's time zone", () => {
    const working = workingDayTest({
      ...DEFAULT_WORKING_DAY,
      timezone: "America/Los_Angeles",
    });
    // 08:00 in Seattle is 15:00 UTC in October (PDT).
    expect(working(at(`${MONDAY}T14:45:00Z`))).toBe(false);
    expect(working(at(`${MONDAY}T15:00:00Z`))).toBe(true);
    // Monday 00:30 UTC is still Sunday evening in Seattle.
    expect(working(at(`${MONDAY}T00:30:00Z`))).toBe(false);
    // Saturday 00:30 UTC is Friday 17:30 in Seattle: working.
    expect(working(at("2026-10-10T00:30:00Z"))).toBe(true);
  });

  it("treats midnight as the start of the day", () => {
    const working = workingDayTest({
      ...DEFAULT_WORKING_DAY,
      startMinutes: 0,
    });
    expect(working(at(`${MONDAY}T00:00:00Z`))).toBe(true);
  });
});

describe("availabilitySlots", () => {
  it("makes one slot per quarter hour, free when nothing overlaps", () => {
    const slots = availabilitySlots(
      at(`${MONDAY}T09:00:00Z`),
      at(`${MONDAY}T10:00:00Z`),
      [],
      [],
    );
    expect(slots).toHaveLength(4);
    expect(slots[1]).toEqual({
      start: at(`${MONDAY}T09:00:00Z`) + SLOT_MS,
      level: Free,
    });
    expect(slots.every((s) => s.level === Free)).toBe(true);
  });

  it("takes a meeting's level in the slots it overlaps, even partly", () => {
    expect(levels("09:00", "10:00", [meeting("09:20", "09:40", Busy)])).toEqual(
      [Free, Busy, Busy, Free],
    );
  });

  it("does not count a meeting in the slot it ends at", () => {
    expect(levels("09:00", "09:30", [meeting("08:30", "09:15", Busy)])).toEqual(
      [Busy, Free],
    );
  });

  it("takes the highest of overlapping meetings", () => {
    expect(
      levels("09:00", "09:30", [
        meeting("09:00", "09:30", Free),
        meeting("09:00", "09:15", Interruptable),
      ]),
    ).toEqual([Interruptable, Free]);
  });

  it("lets a meeting at none (out of office) lower nothing but free", () => {
    expect(levels("09:00", "09:15", [meeting("09:00", "09:15", None)])).toEqual(
      [None],
    );
    expect(
      levels("09:00", "09:15", [
        meeting("09:00", "09:15", None),
        meeting("09:00", "09:15", Free),
      ]),
    ).toEqual([Free]);
  });

  it("lets a block win over every meeting, even a busier one", () => {
    expect(
      levels(
        "09:00",
        "09:30",
        [meeting("09:00", "09:30", Busy)],
        [block("09:00", "09:15", Free)],
      ),
    ).toEqual([Free, Busy]);
  });

  it("takes the highest of overlapping blocks", () => {
    expect(
      levels(
        "09:00",
        "09:15",
        [],
        [block("09:00", "09:15", Free), block("09:00", "09:15", Busy)],
      ),
    ).toEqual([Busy]);
  });

  it("is none outside the working day, whatever the calendar says", () => {
    expect(levels("17:45", "18:30", [meeting("17:45", "18:30", Busy)])).toEqual(
      [Busy, None, None],
    );
  });

  it("counts blocks and meetings the user set outside the working day", () => {
    expect(
      levels(
        "18:00",
        "18:45",
        [meeting("18:00", "18:15", Interruptable, true)],
        [block("18:30", "18:45", Busy)],
      ),
    ).toEqual([Interruptable, None, Busy]);
  });

  it("uses the working day it is given", () => {
    expect(
      levels("06:45", "07:15", [], [], {
        ...DEFAULT_WORKING_DAY,
        startMinutes: 7 * 60,
      }),
    ).toEqual([None, Free]);
  });

  it("makes no slots for an empty range", () => {
    expect(levels("09:00", "09:00")).toEqual([]);
  });
});
