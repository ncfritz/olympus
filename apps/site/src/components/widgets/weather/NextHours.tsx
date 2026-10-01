import { type ForecastStep } from "@ncfritz/olympus-sdk/olympus";
import { Segmented } from "antd";
import { useId, useState } from "react";
import {
  plot,
  STEP_MEASURES,
  type StepMeasure,
  stepMeasure,
} from "../../../utils/forecastChart";
import { chance, formatHour } from "../../../utils/weather";
import ConditionIcon from "./ConditionIcon";
import styles from "./WeatherWidget.module.css";

export interface NextHoursProps {
  steps: ForecastStep[];
  utcOffsetSeconds: number;
}

/** The curve's band in each column, and the room above and below it. */
const PLOT = { height: 72, top: 24, bottom: 8 };
/** A label's bottom sits this far above its point. */
const LABEL_GAP = 6;
const LABEL_HEIGHT = 16;

/**
 * The next 24 hours as eight 3-hour steps (the free plan's resolution):
 * each step's time and weather, then a curve of the measure picked below
 * (temperature, feels like, humidity or pressure) with each step's value
 * over its point, then its chance of precipitation.
 *
 * The curve is one SVG across the eight columns, inside the first: the
 * columns are equal, so eight times its width is the row's. Its x is in
 * columns and it stretches to fit; the line keeps its width
 * (`non-scaling-stroke`) and the labels are text in each column, so
 * nothing distorts and every value is in the list for a screen reader.
 */
const NextHours: React.FunctionComponent<NextHoursProps> = ({
  steps,
  utcOffsetSeconds,
}: NextHoursProps) => {
  const [measureName, setMeasureName] = useState<StepMeasure>("temperature");
  const measure = stepMeasure(measureName);
  const values = steps.map(measure.read);
  const { ys, d } = plot(values, { ...PLOT, minSpan: measure.minSpan });
  const gradientId = `${useId()}-line`;
  const columns = steps.length;

  return (
    <section className={styles.section} aria-labelledby="weather-next">
      <h3 id="weather-next" className={styles.sectionTitle}>
        Next 24 hours
      </h3>
      <ol className={styles.hours} aria-label="Three-hour steps">
        {steps.map((step, index) => (
          <li key={step.time} className={styles.hour}>
            <span className={styles.muted}>
              {formatHour(step.time, utcOffsetSeconds)}
            </span>
            <ConditionIcon
              kind={step.conditionKind}
              isDaytime={step.isDaytime}
              label={step.condition}
            />
            <div className={styles.hourPlot} style={{ height: PLOT.height }}>
              {index === 0 && (
                <svg
                  className={styles.hourCurve}
                  style={{ width: `${columns * 100}%` }}
                  viewBox={`0 0 ${columns} ${PLOT.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <defs>
                    <linearGradient
                      id={gradientId}
                      gradientUnits="userSpaceOnUse"
                      x1="0"
                      y1="0"
                      x2={columns}
                      y2="0"
                    >
                      {values.map((value, i) => (
                        <stop
                          key={i}
                          offset={(i + 0.5) / columns}
                          stopColor={measure.color(value)}
                        />
                      ))}
                    </linearGradient>
                  </defs>
                  <path
                    d={d}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              <span
                className={`${styles.hourValue} ${
                  measure.format(values[index]).length > 4
                    ? styles.hourValueLong
                    : ""
                }`}
                style={{ top: ys[index] - LABEL_GAP - LABEL_HEIGHT }}
              >
                <span className={styles.visuallyHidden}>{measure.name} </span>
                {measure.format(values[index])}
              </span>
            </div>
            <span className={styles.chance}>
              {chance(step.precipitationChancePct)}
            </span>
          </li>
        ))}
      </ol>
      <Segmented<StepMeasure>
        block
        size="small"
        aria-label="Measure shown"
        options={STEP_MEASURES.map(({ value, label }) => ({ value, label }))}
        value={measureName}
        onChange={setMeasureName}
      />
    </section>
  );
};

export default NextHours;
