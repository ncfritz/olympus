import type { ForecastStep } from "@ncfritz/olympus-sdk/olympus";
import { describe, expect, it } from "vitest";
import {
  availableMeasures,
  plot,
  STEP_MEASURES,
  stepMeasure,
} from "../../src/utils/forecastChart";

const SIZE = { height: 72, top: 24, bottom: 8 };

describe("plot", () => {
  it("puts the highest value at the top and the lowest at the bottom", () => {
    const { ys } = plot([60, 70, 80], { ...SIZE, minSpan: 10 });
    expect(ys).toEqual([64, 44, 24]);
  });

  it("centres values that span less than the minimum", () => {
    // 2° of change over a 10° span: the middle of the plot, not its edges.
    const { ys } = plot([69, 71], { ...SIZE, minSpan: 10 });
    expect(ys[0]).toBeCloseTo(48);
    expect(ys[1]).toBeCloseTo(40);
  });

  it("draws an unchanging measure as a level line in the middle", () => {
    const { ys } = plot([29.92, 29.92, 29.92], { ...SIZE, minSpan: 0.2 });
    expect(ys).toEqual([44, 44, 44]);
  });

  it("draws a smooth path through every point, in column units", () => {
    const { d } = plot([60, 70, 80], { ...SIZE, minSpan: 10 });
    expect(d.startsWith("M0.5,64 C")).toBe(true);
    expect(d.endsWith(" 2.5,24")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
  });

  it("never bulges past a peak", () => {
    const { d } = plot([60, 80, 60], { ...SIZE, minSpan: 10 });
    const heights = [...d.matchAll(/[\d.]+,([\d.]+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.min(...heights)).toBe(24);
  });

  it("has nothing to draw without values", () => {
    expect(plot([], { ...SIZE, minSpan: 10 })).toEqual({ ys: [], d: "" });
  });
});

describe("step measures", () => {
  const step = {
    temperatureF: 72.6,
    feelsLikeF: 74.2,
    humidityPct: 41,
    pressureInHg: 29.9,
  } as ForecastStep;

  it.each([
    ["temperature", "73°"],
    ["feelsLike", "74°"],
    ["humidity", "41%"],
    ["pressure", "29.90"],
  ] as const)("reads and formats %s as %s", (value, text) => {
    const measure = stepMeasure(value);
    expect(measure.format(measure.read(step))).toBe(text);
  });

  it("colours temperatures by value and the others by measure", () => {
    const temperature = stepMeasure("temperature");
    expect(temperature.color(40)).not.toBe(temperature.color(90));
    const humidity = stepMeasure("humidity");
    expect(humidity.color(20)).toBe(humidity.color(90));
  });

  it("offers the four in the picker's order", () => {
    expect(STEP_MEASURES.map((measure) => measure.label)).toEqual([
      "Temp",
      "Feels like",
      "Humidity",
      "Pressure",
    ]);
  });
});

describe("missing values", () => {
  // An API older than these fields sends steps without them.
  const old = { temperatureF: 72 } as ForecastStep;

  it.each(["feelsLike", "humidity", "pressure"] as const)(
    "reads a step without %s as missing and shows a dash",
    (value) => {
      const measure = stepMeasure(value);
      const read = measure.read(old);
      expect(read).toBeUndefined();
      expect(measure.format(read)).toBe("—");
    },
  );

  it("leaves a gap in the line where a value is missing", () => {
    const { ys, d } = plot([60, undefined, 70, 80], { ...SIZE, minSpan: 10 });
    expect(ys[1]).toBeUndefined();
    expect(ys[0]).toBe(64);
    // Two pieces: the first point alone, then the last two.
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).not.toMatch(/NaN/);
  });

  it("has nothing to draw when every value is missing", () => {
    expect(plot([undefined, undefined], { ...SIZE, minSpan: 10 })).toEqual({
      ys: [undefined, undefined],
      d: "",
    });
  });

  it("offers only the measures some step has", () => {
    expect(availableMeasures([old])).toEqual(["temperature"]);
    expect(
      availableMeasures([
        {
          temperatureF: 72,
          feelsLikeF: 71,
          humidityPct: 50,
          pressureInHg: 29.9,
        } as ForecastStep,
      ]),
    ).toEqual(["temperature", "feelsLike", "humidity", "pressure"]);
  });
});
