import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_LAYOUT,
  parseHomeLayout,
  toPercentages,
} from "../../src/utils/homeLayout";

describe("home layout", () => {
  it("keeps a stored layout that is whole", () => {
    const stored = {
      sizes: ["20%", "0%", "80%"],
      collapsed: [false, true, false],
    };
    expect(parseHomeLayout(stored)).toEqual(stored);
  });

  it.each([
    ["nothing", null],
    ["a string", "25%,45%,30%"],
    ["two columns", { sizes: ["50%", "50%"], collapsed: [false, false] }],
    [
      "pixel widths",
      { sizes: [300, 500, 400], collapsed: [false, false, false] },
    ],
    ["no collapsed flags", { sizes: ["25%", "45%", "30%"] }],
  ])("falls back to the default for %s", (_case, stored) => {
    expect(parseHomeLayout(stored)).toBe(DEFAULT_HOME_LAYOUT);
  });

  it("turns pixel sizes into percentages of the row", () => {
    expect(toPercentages([300, 500, 400])).toEqual(["25%", "41.67%", "33.33%"]);
    expect(toPercentages([0, 600, 600])).toEqual(["0%", "50%", "50%"]);
    expect(toPercentages([0, 0, 0])).toBe(DEFAULT_HOME_LAYOUT.sizes);
  });
});
