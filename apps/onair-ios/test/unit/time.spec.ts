import { describe, expect, it } from "vitest";

import { dayAround, levelAt } from "../../src/time";

describe("dayAround", () => {
  it("runs from local midnight to the next", () => {
    const { start, end } = dayAround(new Date(2026, 9, 14, 11, 11));
    expect(start).toEqual(new Date(2026, 9, 14));
    expect(end).toEqual(new Date(2026, 9, 15));
  });
});

describe("levelAt", () => {
  const slots = [
    { startTime: "2026-10-14T18:00:00.000Z", status: "busy" as const },
    { startTime: "2026-10-14T18:15:00.000Z", status: "free" as const },
  ];

  it("finds the slot a moment falls in", () => {
    expect(levelAt(slots, new Date("2026-10-14T18:11:00.000Z"))).toBe("busy");
    expect(levelAt(slots, new Date("2026-10-14T18:15:00.000Z"))).toBe("free");
  });

  it("is undefined outside the slots", () => {
    expect(
      levelAt(slots, new Date("2026-10-14T18:30:00.000Z")),
    ).toBeUndefined();
    expect(levelAt([], new Date())).toBeUndefined();
  });
});
