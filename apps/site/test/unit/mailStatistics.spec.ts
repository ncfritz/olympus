import { describe, expect, it } from "vitest";
import {
  labelHeatmap,
  labelsByVolume,
  senderSeries,
  withoutZeros,
  yearSpan,
} from "../../src/utils/mailStatistics";

describe("mail statistics charts", () => {
  it("spans every year from the first to the last", () => {
    expect(yearSpan([{ year: 2024 }, { year: 2021 }])).toEqual([
      2021, 2022, 2023, 2024,
    ]);
    expect(yearSpan([])).toEqual([]);
  });

  it("gives a sender a zero for a year it sent nothing", () => {
    const rows = [
      { address: "a@x.example", year: 2021, messages: 5 },
      { address: "a@x.example", year: 2023, messages: 2 },
      { address: "b@y.example", year: 2022, messages: 7 },
    ];
    expect(senderSeries(rows, yearSpan(rows))).toEqual([
      { name: "a@x.example", data: [5, 0, 2] },
      { name: "b@y.example", data: [0, 7, 0] },
    ]);
  });

  it("orders labels busiest first, ties by name", () => {
    expect(
      labelsByVolume([
        { name: "B", year: 2021, messages: 1 },
        { name: "A", year: 2021, messages: 1 },
        { name: "C", year: 2021, messages: 1 },
        { name: "C", year: 2022, messages: 4 },
      ]),
    ).toEqual(["C", "A", "B"]);
  });

  it("fills every cell, shading each label against its own busiest year", () => {
    const rows = [
      { name: "Bills", year: 2021, messages: 400 },
      { name: "Bills", year: 2022, messages: 100 },
      { name: "Shop", year: 2022, messages: 2 },
    ];
    expect(labelHeatmap(rows, ["Bills", "Shop"], [2021, 2022])).toEqual([
      { x: 0, y: 0, value: 1, count: 400 },
      { x: 1, y: 0, value: 0.25, count: 100 },
      { x: 0, y: 1, value: 0, count: 0 },
      { x: 1, y: 1, value: 1, count: 2 },
    ]);
  });

  it("leaves a year without mail out of a line on a log axis", () => {
    expect(withoutZeros([3, 0, 1])).toEqual([3, null, 1]);
  });
});
