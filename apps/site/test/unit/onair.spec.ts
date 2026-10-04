import type { Availability } from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import {
  drawerRange,
  isOnAir,
  signalStatus,
  toLevel,
  toOnAirEvents,
  toOnAirStatus,
} from "../../src/utils/onair";

const SLOT = 15 * 60 * 1000;
const at = (iso: string) => Date.parse(iso);

const availability = (overrides: Partial<Availability> = {}): Availability => ({
  startTime: "2026-10-05T10:00:00.000Z",
  endTime: "2026-10-05T11:00:00.000Z",
  slots: [
    { startTime: "2026-10-05T10:00:00.000Z", status: "busy" },
    { startTime: "2026-10-05T10:15:00.000Z", status: "interruptable" },
    { startTime: "2026-10-05T10:30:00.000Z", status: "free" },
    { startTime: "2026-10-05T10:45:00.000Z", status: "none" },
  ],
  meetings: [],
  blocks: [],
  ...overrides,
});

describe("the drawer's words for levels", () => {
  it.each([
    ["busy", "dnd"],
    ["interruptable", "interrupt"],
    ["free", "free"],
    ["none", "clear"],
  ] as const)("%s is %s, and back", (level, word) => {
    expect(toOnAirStatus(level)).toBe(word);
    expect(toLevel(word)).toBe(level);
  });

  it("reads a word it does not know as none", () => {
    expect(toLevel("off")).toBe("none");
  });
});

describe("isOnAir", () => {
  it("lights for busy and interruptable only", () => {
    expect(isOnAir("busy")).toBe(true);
    expect(isOnAir("interruptable")).toBe(true);
    expect(isOnAir("free")).toBe(false);
    expect(isOnAir("none")).toBe(false);
    expect(isOnAir(undefined)).toBe(false);
  });
});

describe("toOnAirEvents", () => {
  it("gives each slot the strength the drawer shades it by", () => {
    const { signals } = toOnAirEvents(availability());
    const key = (iso: string) => String(at(iso) / SLOT);

    expect(signals).toEqual({
      [key("2026-10-05T10:00:00Z")]: 4,
      [key("2026-10-05T10:15:00Z")]: 2,
      [key("2026-10-05T10:30:00Z")]: 1,
      [key("2026-10-05T10:45:00Z")]: 0,
    });
    expect(Object.values(signals).map(signalStatus)).toEqual([
      "dnd",
      "interrupt",
      "free",
      "clear",
    ]);
  });

  it("shows meetings with their calendar status, and the level the user set", () => {
    const { events } = toOnAirEvents(
      availability({
        meetings: [
          {
            meetingId: "m-1",
            subject: "Planning",
            startTime: "2026-10-05T10:00:00.000Z",
            endTime: "2026-10-05T10:30:00.000Z",
            calendarStatus: "Busy",
            status: "busy",
            overridden: false,
            counted: true,
          },
          {
            meetingId: "m-2",
            startTime: "2026-10-05T10:30:00.000Z",
            endTime: "2026-10-05T10:45:00.000Z",
            calendarStatus: "Busy",
            status: "interruptable",
            overridden: true,
            counted: true,
          },
        ],
      }),
    );

    expect(events).toEqual([
      {
        id: "m-1",
        start: "2026-10-05T10:00:00.000Z",
        end: "2026-10-05T10:30:00.000Z",
        editable: false,
        extendedProps: { subject: "Planning", status: "Busy" },
      },
      {
        id: "m-2",
        start: "2026-10-05T10:30:00.000Z",
        end: "2026-10-05T10:45:00.000Z",
        editable: false,
        extendedProps: {
          subject: "",
          status: "Busy",
          onairStatus: "interrupt",
        },
      },
    ]);
  });

  it("shows blocks as overrides in the drawer's words", () => {
    const { overrides, start, end } = toOnAirEvents(
      availability({
        blocks: [
          {
            id: "b-1",
            startTime: "2026-10-05T11:00:00.000Z",
            endTime: "2026-10-05T11:15:00.000Z",
            status: "busy",
            label: "Focus",
            createdTime: "2026-10-04T12:00:00.000Z",
            lastUpdatedTime: "2026-10-04T12:00:00.000Z",
          },
          {
            id: "b-2",
            startTime: "2026-10-05T12:00:00.000Z",
            endTime: "2026-10-05T12:15:00.000Z",
            status: "none",
            createdTime: "2026-10-04T12:00:00.000Z",
            lastUpdatedTime: "2026-10-04T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(overrides).toEqual([
      {
        id: "b-1",
        start: "2026-10-05T11:00:00.000Z",
        end: "2026-10-05T11:15:00.000Z",
        extendedProps: { subject: "Focus", status: "dnd", type: "Override" },
      },
      expect.objectContaining({
        id: "b-2",
        extendedProps: {
          subject: "OVERRIDE",
          status: "clear",
          type: "Override",
        },
      }),
    ]);
    expect(start).toBe("2026-10-05T10:00:00.000Z");
    expect(end).toBe("2026-10-05T11:00:00.000Z");
  });
});

describe("drawerRange", () => {
  it("runs from a week before today to two weeks after, local midnights", () => {
    const { start, end } = drawerRange(new Date(2026, 9, 5, 15, 30));

    expect(new Date(start)).toEqual(new Date(2026, 8, 28));
    expect(new Date(end)).toEqual(new Date(2026, 9, 20));
  });
});
