import { describe, expect, it } from "vitest";

import {
  allDayOn,
  clearUntil,
  type Availability,
  type Block,
  causeTitle,
  clock,
  clockWithPeriod,
  countdown,
  covered,
  dayStrip,
  dayTitle,
  duration,
  type Item,
  itemsBetween,
  layoutColumns,
  lengthChoices,
  loadWindow,
  type Meeting,
  nowState,
  overridesByDay,
  segments,
  type Slot,
  upNext,
  weekOf,
} from "../../src/schedule";

/** Local wall-clock times on Tuesday 14 October 2026, as ISO strings. */
const at = (hour: number, minute = 0, day = 14) =>
  new Date(2026, 9, day, hour, minute);
const iso = (hour: number, minute = 0, day = 14) =>
  at(hour, minute, day).toISOString();

/** 15-minute slots from `from` to `to` (hours, local), at `status`. */
const slots = (from: number, to: number, status: Slot["status"]): Slot[] => {
  const out: Slot[] = [];
  for (let t = from * 60; t < to * 60; t += 15) {
    out.push({ startTime: iso(Math.floor(t / 60), t % 60), status });
  }
  return out;
};

const meeting = (overrides: Partial<Meeting>): Meeting => ({
  meetingId: "m",
  subject: "Meeting",
  startTime: iso(11),
  endTime: iso(11, 45),
  calendarStatus: "Busy",
  status: "busy",
  overridden: false,
  counted: true,
  ...overrides,
});

const block = (overrides: Partial<Block>): Block => ({
  id: "b",
  startTime: iso(15),
  endTime: iso(16, 30),
  status: "interruptable",
  label: "Focus time",
  ...overrides,
});

const DAY: Availability = {
  slots: [
    ...slots(8, 11, "free"),
    ...slots(11, 11.75, "busy"),
    ...slots(11.75, 12.5, "interruptable"),
    ...slots(12.5, 18, "free"),
  ],
  meetings: [
    meeting({ meetingId: "review", subject: "Design review" }),
    meeting({
      meetingId: "hours",
      subject: "Office hours",
      startTime: iso(11, 45),
      endTime: iso(12, 30),
      status: "interruptable",
      overridden: true,
    }),
    meeting({
      meetingId: "vendor",
      subject: "Vendor call",
      startTime: iso(14),
      endTime: iso(15),
    }),
  ],
  blocks: [block({})],
};

describe("words", () => {
  it("tells the time as the lists do", () => {
    expect(clock(at(11, 5))).toBe("11:05");
    expect(clock(at(14))).toBe("2:00");
    expect(clock(at(0, 30))).toBe("12:30");
    expect(clockWithPeriod(at(11, 11))).toBe("11:11 AM");
    expect(clockWithPeriod(at(12))).toBe("12:00 PM");
  });

  it("says how long", () => {
    expect(duration(45 * 60_000)).toBe("45 min");
    expect(duration(60 * 60_000)).toBe("1 hr");
    expect(duration(90 * 60_000)).toBe("1 hr 30 min");
  });

  it("counts down", () => {
    expect(countdown((33 * 60 + 42) * 1000)).toBe("33:42");
    expect(countdown((65 * 60 + 12) * 1000)).toBe("1:05:12");
    expect(countdown(-5)).toBe("0:00");
  });

  it("names days relative to today", () => {
    const now = at(11);
    expect(dayTitle(at(0, 0, 14), now)).toBe("Today");
    expect(dayTitle(at(9, 0, 15), now)).toBe("Tomorrow");
    expect(dayTitle(at(9, 0, 13), now)).toBe("Yesterday");
    expect(dayTitle(at(9, 0, 16), now)).toBe("Friday, Oct 16");
  });
});

describe("days", () => {
  it("loads a week back and two weeks ahead", () => {
    const { start, end } = loadWindow(at(11));
    expect(start).toEqual(new Date(2026, 9, 7));
    expect(end).toEqual(new Date(2026, 9, 29));
  });

  it("has a Monday-to-Sunday week", () => {
    const week = weekOf(at(11));
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual(new Date(2026, 9, 12));
    expect(week[6]).toEqual(new Date(2026, 9, 18));
  });
});

describe("nowState", () => {
  it("runs neighbouring slots at one level together", () => {
    expect(segments(DAY.slots).map((run) => run.level)).toEqual([
      "free",
      "busy",
      "interruptable",
      "free",
    ]);
  });

  it("knows the status, why, how far through, and what follows", () => {
    const state = nowState(DAY, at(11, 15))!;
    expect(state.status).toBe("dnd");
    expect(state.since).toBe(at(11).getTime());
    expect(state.until).toBe(at(11, 45).getTime());
    expect(state.progress).toBeCloseTo(1 / 3);
    expect(causeTitle(state.cause)).toBe("Design review");
    expect(state.next?.status).toBe("interrupt");
    expect(state.next?.at).toBe(at(11, 45).getTime());
    expect(causeTitle(state.next?.cause)).toBe("Office hours");
  });

  it("puts an override before a meeting at the same time", () => {
    const withBlock: Availability = {
      ...DAY,
      blocks: [
        block({ startTime: iso(11), endTime: iso(11, 30), status: "busy" }),
      ],
    };
    expect(nowState(withBlock, at(11, 10))?.cause?.kind).toBe("block");
  });

  it("is undefined outside the slots", () => {
    expect(nowState(DAY, at(20))).toBeUndefined();
  });
});

describe("dayStrip", () => {
  it("covers the working day in order, with where now falls", () => {
    const { parts, nowFraction } = dayStrip(DAY.slots, at(13));
    expect(parts.map((part) => part.status)).toEqual([
      "free",
      "dnd",
      "interrupt",
      "free",
    ]);
    expect(parts.reduce((sum, part) => sum + part.fraction, 0)).toBeCloseTo(1);
    expect(nowFraction).toBeCloseTo(0.5);
  });

  it("is clear where there are no slots, and has no now after hours", () => {
    const { parts, nowFraction } = dayStrip([], at(20));
    expect(parts).toEqual([{ status: "clear", fraction: 1 }]);
    expect(nowFraction).toBeUndefined();
  });
});

describe("items", () => {
  it("describes meetings and overrides for their row", () => {
    const items = itemsBetween(DAY, at(0).getTime(), at(24).getTime());
    expect(items.map((item) => [item.title, item.status, item.detail])).toEqual(
      [
        ["Design review", "dnd", "Busy · 45 min"],
        ["Office hours", "interrupt", "Busy → set to Interruptable"],
        ["Vendor call", "dnd", "Busy · 1 hr"],
        ["Focus time", "interrupt", "Override · Interruptable · 1 hr 30 min"],
      ],
    );
  });

  it("lists what starts later today as up next", () => {
    expect(upNext(DAY, at(11, 15)).map((item) => item.title)).toEqual([
      "Office hours",
      "Vendor call",
      "Focus time",
    ]);
  });
});

describe("layoutColumns", () => {
  const item = (id: string, from: number, to: number): Item => ({
    kind: "meeting",
    id,
    start: at(from).getTime(),
    end: at(to).getTime(),
    title: id,
    status: "dnd",
    detail: "",
  });

  it("puts overlapping items side by side and the rest full width", () => {
    const placed = layoutColumns([
      item("a", 9, 11),
      item("b", 10, 12),
      item("c", 11, 12),
      item("d", 13, 14),
    ]);
    const by = Object.fromEntries(placed.map((p) => [p.id, p]));
    expect([by.a!.column, by.b!.column, by.c!.column]).toEqual([0, 1, 0]);
    expect([by.a!.columns, by.b!.columns, by.c!.columns]).toEqual([2, 2, 2]);
    expect([by.d!.column, by.d!.columns]).toEqual([0, 1]);
  });
});

describe("overridesByDay", () => {
  it("splits upcoming from past, grouped by day", () => {
    const { upcoming, past } = overridesByDay(
      [
        block({ id: "today", startTime: iso(15), endTime: iso(16) }),
        block({
          id: "tomorrow",
          startTime: iso(9, 0, 15),
          endTime: iso(10, 0, 15),
        }),
        block({ id: "done", startTime: iso(8), endTime: iso(9) }),
        block({
          id: "monday",
          startTime: iso(8, 0, 12),
          endTime: iso(9, 0, 12),
        }),
      ],
      at(11),
    );
    expect(upcoming.map((group) => group.items.map((i) => i.id))).toEqual([
      ["today"],
      ["tomorrow"],
    ]);
    expect(past.map((group) => group.items.map((i) => i.id))).toEqual([
      ["done"],
      ["monday"],
    ]);
  });
});

describe("lengthChoices", () => {
  it("offers fixed lengths, the meeting in progress, and the rest of the day", () => {
    const choices = lengthChoices(DAY, at(11, 11));
    expect(choices.map((choice) => choice.key)).toEqual([
      "30m",
      "1h",
      "2h",
      "meeting",
      "day",
    ]);
    expect(choices.find((c) => c.key === "meeting")?.end).toBe(
      at(11, 45).getTime(),
    );
    expect(choices.find((c) => c.key === "day")?.end).toBe(at(18).getTime());
  });

  it("runs the rest of the day to midnight after working hours", () => {
    const choices = lengthChoices({ ...DAY, meetings: [] }, at(19));
    expect(choices.map((choice) => choice.key)).not.toContain("meeting");
    expect(choices.at(-1)?.end).toBe(new Date(2026, 9, 15).getTime());
  });

  it("names the meetings an override covers", () => {
    expect(
      covered(DAY, at(11, 11).getTime(), at(12, 11).getTime()).map(
        (m) => m.subject,
      ),
    ).toEqual(["Design review", "Office hours"]);
  });
});

describe("all-day events", () => {
  const holiday = meeting({
    meetingId: "h",
    subject: "Holiday",
    startTime: at(0).toISOString(),
    endTime: at(0, 0, 15).toISOString(),
    calendarStatus: "Free",
    status: "free",
    isAllDay: true,
  });
  // Stored from UTC midnight: in Los Angeles it starts the evening before.
  const utc = meeting({
    meetingId: "u",
    subject: "Birthday",
    startTime: new Date(Date.UTC(2026, 9, 14)).toISOString(),
    endTime: new Date(Date.UTC(2026, 9, 15)).toISOString(),
    calendarStatus: "Free",
    status: "free",
    isAllDay: true,
  });
  const avail: Availability = {
    slots: [],
    meetings: [holiday, utc, meeting({})],
    blocks: [],
  };

  it("lists them for their day, by title, and not on the timeline", () => {
    expect(allDayOn(avail, at(12)).map((item) => item.id)).toEqual(["u", "h"]);
    expect(allDayOn(avail, at(12))[1]?.detail).toBe("All day · Free");
    expect(allDayOn(avail, at(12, 0, 13))).toEqual([]);
    expect(
      itemsBetween(avail, at(0).getTime(), at(0, 0, 15).getTime()).map(
        (item) => item.id,
      ),
    ).toEqual(["m"]);
  });
});

describe("clearUntil", () => {
  const off = (until: Date) => ({
    level: "none" as const,
    status: "clear" as const,
    since: at(18).getTime(),
    progress: 0,
    until: until.getTime(),
  });

  it("says when work starts again, off hours only", () => {
    expect(clearUntil(off(at(23)), at(19))).toBe("11:00 PM");
    expect(clearUntil(off(at(8, 0, 15)), at(19))).toBe("tomorrow, 8:00 AM");
    expect(clearUntil(off(at(8, 0, 19)), at(19))).toBe("Monday, 8:00 AM");
    expect(
      clearUntil({ ...off(at(23)), level: "free", status: "free" }, at(19)),
    ).toBeUndefined();
    expect(clearUntil(undefined, at(19))).toBeUndefined();
  });
});

describe("working hours", () => {
  it("draws the day strip over the hours set", () => {
    const strip = dayStrip(slots(9, 17, "free"), at(13), {
      dayStart: 9 * 60,
      dayEnd: 17 * 60,
      weekendsFree: true,
    });
    expect(strip.parts).toEqual([{ status: "free", fraction: 1 }]);
    expect(strip.nowFraction).toBe(0.5);
  });
});
