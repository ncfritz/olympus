import { describe, expect, it } from "vitest";
import {
  chance,
  chooseLocation,
  compassPoint,
  dayLabel,
  degrees,
  formatClock,
  formatHour,
  moveItem,
  nextFrame,
  rangeBars,
} from "../../src/utils/weather";

const PACIFIC = -25_200;
const BATH = 3600;

describe("weather helpers", () => {
  it("reads times at the location, not in the browser's zone", () => {
    expect(formatHour("2026-09-29T21:00:00Z", PACIFIC)).toBe("2 PM");
    expect(formatHour("2026-09-29T21:00:00Z", BATH)).toBe("10 PM");
    expect(formatClock("2026-09-29T19:50:00Z", PACIFIC)).toBe("12:50 PM");
  });

  it("labels today and then the weekdays", () => {
    expect(dayLabel("2026-09-29", 0)).toBe("Today");
    expect(dayLabel("2026-09-30", 1)).toBe("Wed");
    expect(dayLabel("2026-10-03", 4)).toBe("Sat");
  });

  it("rounds temperatures and hides a negligible chance", () => {
    expect(degrees(58.5)).toBe("59°");
    expect(degrees(-0.4)).toBe("0°");
    expect(chance(70)).toBe("70%");
    expect(chance(5)).toBe("");
  });

  it.each([
    [0, "N"],
    [202, "SSW"],
    [359, "N"],
    [90, "E"],
    [-45, "NW"],
  ])("calls %i° %s", (deg, point) => {
    expect(compassPoint(deg)).toBe(point);
  });

  it("puts every day's bar on one scale", () => {
    const bars = rangeBars([
      { lowF: 49, highF: 61 },
      { lowF: 47, highF: 66 },
      { lowF: 55, highF: 55 },
    ]);
    // 47 to 66 is the track.
    expect(bars[0]).toEqual({ left: 11, width: 63 });
    expect(bars[1]).toEqual({ left: 0, width: 100 });
    // A day with no range still gets a sliver.
    expect(bars[2].width).toBe(2);
    expect(rangeBars([])).toEqual([]);
  });

  it("opens on the location picked, else the default, else the first", () => {
    const locations = [
      { id: "a", isDefault: false },
      { id: "b", isDefault: true },
    ];
    expect(chooseLocation(locations, "a")).toBe("a");
    expect(chooseLocation(locations, "gone")).toBe("b");
    expect(chooseLocation(locations)).toBe("b");
    expect(chooseLocation([{ id: "a", isDefault: false }])).toBe("a");
    expect(chooseLocation([])).toBeUndefined();
  });

  it("moves an item within a list", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("loops the radar frames", () => {
    expect(nextFrame(0, 13)).toBe(1);
    expect(nextFrame(12, 13)).toBe(0);
    expect(nextFrame(0, 0)).toBe(0);
  });
});
