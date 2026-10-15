import { describe, expect, it } from "vitest";
import {
  isOnAir,
  LABELS,
  type Level,
  levelOfCalendarStatus,
  STATUSES,
  toLevel,
  toOnAirStatus,
} from "../../src";

const LEVELS: Level[] = ["none", "free", "interruptable", "busy"];

describe("availability words", () => {
  it("maps each level to OnAir's word and back", () => {
    expect(LEVELS.map(toOnAirStatus)).toEqual([
      "clear",
      "free",
      "interrupt",
      "dnd",
    ]);
    for (const level of LEVELS) {
      expect(toLevel(toOnAirStatus(level))).toBe(level);
    }
  });

  it("reads any other word as none", () => {
    expect(toLevel("busy")).toBe("none");
    expect(toLevel("")).toBe("none");
  });

  it("lights the sign for busy and interruptable only", () => {
    expect(LEVELS.filter(isOnAir)).toEqual(["interruptable", "busy"]);
    expect(isOnAir(undefined)).toBe(false);
  });

  it("derives a meeting's level from its calendar status as the API does", () => {
    expect(levelOfCalendarStatus("Free")).toBe("free");
    expect(levelOfCalendarStatus("Tentative")).toBe("interruptable");
    expect(levelOfCalendarStatus("OOF")).toBe("none");
    expect(levelOfCalendarStatus("WorkingElsewhere")).toBe("none");
    expect(levelOfCalendarStatus("Busy")).toBe("busy");
    expect(levelOfCalendarStatus("SomethingNew")).toBe("busy");
  });

  it("labels every status in picker order", () => {
    expect(STATUSES.map((status) => LABELS[status])).toEqual([
      "Do Not Disturb",
      "Interruptable",
      "Free",
      "Clear",
    ]);
  });
});
