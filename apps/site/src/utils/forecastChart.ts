import type { ForecastStep } from "@ncfritz/olympus-sdk/olympus";
import { degrees, temperatureColor } from "./weather";

/**
 * The Next 24 hours curve (docs/plans/weather/design.md): which measure it
 * draws, and the arithmetic of drawing it, kept out of the component so it
 * can be tested without a DOM.
 */

export type StepMeasure = "temperature" | "feelsLike" | "humidity" | "pressure";

export type StepMeasureSpec = {
  value: StepMeasure;
  /** The picker's label. */
  label: string;
  /** The measure's name, for screen readers. */
  name: string;
  read: (step: ForecastStep) => number;
  format: (value: number) => string;
  /**
   * The smallest range the curve's height stands for, so a measure that
   * barely moves (pressure over a calm day) draws nearly flat rather than
   * as steep as a front coming through.
   */
  minSpan: number;
  /** The line's colour at a value. */
  color: (value: number) => string;
};

const HUMIDITY = "#1677ff";
const PRESSURE = "#08979c";

export const STEP_MEASURES: StepMeasureSpec[] = [
  {
    value: "temperature",
    label: "Temp",
    name: "Temperature",
    read: (step) => step.temperatureF,
    format: degrees,
    minSpan: 10,
    color: temperatureColor,
  },
  {
    value: "feelsLike",
    label: "Feels like",
    name: "Feels like",
    read: (step) => step.feelsLikeF,
    format: degrees,
    minSpan: 10,
    color: temperatureColor,
  },
  {
    value: "humidity",
    label: "Humidity",
    name: "Humidity",
    read: (step) => step.humidityPct,
    format: (value) => `${Math.round(value)}%`,
    minSpan: 20,
    color: () => HUMIDITY,
  },
  {
    value: "pressure",
    label: "Pressure",
    name: "Pressure, inches of mercury",
    read: (step) => step.pressureInHg,
    format: (value) => value.toFixed(2),
    minSpan: 0.2,
    color: () => PRESSURE,
  },
];

export const stepMeasure = (value: StepMeasure): StepMeasureSpec =>
  STEP_MEASURES.find((measure) => measure.value === value) ?? STEP_MEASURES[0];

export type Plot = {
  /** Each value's height in the plot, in pixels from its top. */
  ys: number[];
  /** A smooth path through them, x in columns (the i-th at i + 0.5). */
  d: string;
};

/**
 * The values as heights in a plot `height` pixels tall, the highest `top`
 * pixels from its top and the lowest `bottom` from its bottom, over at
 * least `minSpan` of the measure (centred on the values when they span
 * less), and a monotone curve through them: it never bulges past a value,
 * so a label sits above its point rather than under the line.
 */
export const plot = (
  values: number[],
  {
    height,
    top,
    bottom,
    minSpan,
  }: { height: number; top: number; bottom: number; minSpan: number },
): Plot => {
  if (values.length === 0) return { ys: [], d: "" };
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, minSpan);
  const floor = low - (span - (high - low)) / 2;
  const usable = height - top - bottom;
  const ys = values.map((value) =>
    round(top + usable * (1 - (value - floor) / span)),
  );
  const xs = values.map((_, i) => i + 0.5);
  return { ys, d: monotonePath(xs, ys) };
};

/**
 * A monotone cubic through the points (Fritsch–Carlson, as d3's
 * curveMonotoneX): smooth, and never above or below its neighbours
 * between two points.
 */
const monotonePath = (xs: number[], ys: number[]): string => {
  const n = xs.length;
  const point = (i: number) => `${round(xs[i])},${round(ys[i])}`;
  if (n === 1) return `M${point(0)}`;
  const slopes = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const tangents = xs.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    const before = slopes[i - 1];
    const after = slopes[i];
    // A peak or a trough is flat; elsewhere the harmonic mean keeps the
    // curve from overshooting.
    if (before * after <= 0) return 0;
    return (2 * before * after) / (before + after);
  });
  let d = `M${point(0)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = (xs[i + 1] - xs[i]) / 3;
    const c1 = `${round(xs[i] + third)},${round(ys[i] + tangents[i] * third)}`;
    const c2 = `${round(xs[i + 1] - third)},${round(ys[i + 1] - tangents[i + 1] * third)}`;
    d += ` C${c1} ${c2} ${point(i + 1)}`;
  }
  return d;
};

const round = (value: number) => Math.round(value * 100) / 100;
