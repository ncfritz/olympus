import type { AvailabilityBlock } from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import {
  blockEvent,
  defaultStatusOf,
  dotStatusOf,
  filterOf,
  inGroups,
  isBlockShown,
  isMeetingShown,
  type MeetingFilters,
  meetingEvent,
} from "../../src/utils/meetingAvailability";

const none: MeetingFilters = { hiddenSources: [], hiddenStatuses: [] };

const block = (
  overrides: Partial<AvailabilityBlock> = {},
): AvailabilityBlock => ({
  id: "b1",
  startTime: "2026-10-05T16:00:00.000Z",
  endTime: "2026-10-05T17:00:00.000Z",
  status: "none",
  createdTime: "2026-10-05T00:00:00.000Z",
  lastUpdatedTime: "2026-10-05T00:00:00.000Z",
  ...overrides,
});

describe("defaultStatusOf", () => {
  it("derives a meeting's status from its calendar's, as the API does", () => {
    expect(defaultStatusOf("Busy")).toBe("dnd");
    expect(defaultStatusOf("Tentative")).toBe("interrupt");
    expect(defaultStatusOf("Free")).toBe("free");
    expect(defaultStatusOf("OOF")).toBe("clear");
    expect(defaultStatusOf("WorkingElsewhere")).toBe("clear");
    expect(defaultStatusOf("NoData")).toBe("dnd");
  });
});

describe("dotStatusOf", () => {
  it("shows the availability's status once it has loaded", () => {
    expect(dotStatusOf({ status: "Busy" }, { status: "free" })).toBe("free");
  });

  it("shows the calendar's status until then", () => {
    expect(dotStatusOf({ status: "Tentative" })).toBe("interrupt");
  });
});

describe("filterOf", () => {
  it("files an overridden meeting under its override", () => {
    expect(filterOf({ status: "busy", overridden: true })).toBe("dnd");
    expect(filterOf({ status: "none", overridden: true })).toBe("clear");
  });

  it("files a meeting without one, or not yet loaded, under no override", () => {
    expect(filterOf({ status: "busy", overridden: false })).toBe("default");
    expect(filterOf(undefined)).toBe("default");
  });
});

describe("isMeetingShown", () => {
  const meeting = { source: "work" } as never;

  it("shows everything until something is hidden", () => {
    expect(isMeetingShown(meeting, undefined, none)).toBe(true);
  });

  it("hides a hidden calendar's meetings", () => {
    expect(
      isMeetingShown(meeting, undefined, {
        ...none,
        hiddenSources: ["work"],
      }),
    ).toBe(false);
  });

  it("hides meetings by their override, or by having none", () => {
    const hidden = { ...none, hiddenStatuses: ["dnd" as const] };
    expect(
      isMeetingShown(meeting, { status: "busy", overridden: true }, hidden),
    ).toBe(false);
    expect(
      isMeetingShown(meeting, { status: "busy", overridden: false }, hidden),
    ).toBe(true);
    expect(
      isMeetingShown(meeting, undefined, {
        ...none,
        hiddenStatuses: ["default"],
      }),
    ).toBe(false);
  });
});

describe("isBlockShown", () => {
  it("hides blocks by their status", () => {
    expect(isBlockShown(block(), none)).toBe(true);
    expect(isBlockShown(block(), { ...none, hiddenStatuses: ["clear"] })).toBe(
      false,
    );
  });
});

describe("meetingEvent", () => {
  it("keeps the event and adds what the dot shows", () => {
    expect(
      meetingEvent(
        { id: "m1", title: "Sync", classNames: ["oa-event"] },
        { id: "m1", status: "Busy" },
        { status: "free", overridden: true },
      ),
    ).toEqual({
      id: "m1",
      title: "Sync",
      classNames: ["oa-event"],
      extendedProps: {
        kind: "meeting",
        meetingId: "m1",
        status: "free",
        overridden: true,
      },
    });
  });
});

describe("blockEvent", () => {
  it("is hatched in its status, movable, and apart from the meetings", () => {
    expect(blockEvent(block({ status: "busy", label: "Focus" }))).toEqual({
      id: "block:b1",
      start: "2026-10-05T16:00:00.000Z",
      end: "2026-10-05T17:00:00.000Z",
      title: "Focus",
      editable: true,
      classNames: ["oa-event", "oa-override-dnd"],
      extendedProps: {
        kind: "block",
        blockId: "b1",
        status: "dnd",
        overridden: true,
      },
    });
    expect(blockEvent(block()).title).toBe("Override");
  });
});

describe("inGroups", () => {
  it("splits a list into groups of at most the size", () => {
    expect(inGroups([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inGroups([], 2)).toEqual([]);
  });
});
