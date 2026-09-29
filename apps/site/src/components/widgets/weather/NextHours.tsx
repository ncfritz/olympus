import { type ForecastStep } from "@ncfritz/olympus-sdk/olympus";
import { chance, degrees, formatHour } from "../../../utils/weather";
import ConditionIcon from "./ConditionIcon";
import styles from "./WeatherWidget.module.css";

export interface NextHoursProps {
  steps: ForecastStep[];
  utcOffsetSeconds: number;
}

/** The next 24 hours as eight 3-hour steps (the free plan's resolution). */
const NextHours: React.FunctionComponent<NextHoursProps> = ({
  steps,
  utcOffsetSeconds,
}: NextHoursProps) => (
  <section className={styles.section} aria-labelledby="weather-next">
    <h3 id="weather-next" className={styles.sectionTitle}>
      Next 24 hours
    </h3>
    <ol className={styles.hours} aria-label="Three-hour steps">
      {steps.map((step) => (
        <li key={step.time} className={styles.hour}>
          <span className={styles.muted}>
            {formatHour(step.time, utcOffsetSeconds)}
          </span>
          <ConditionIcon
            kind={step.conditionKind}
            isDaytime={step.isDaytime}
            label={step.condition}
          />
          <span className={styles.hourTemperature}>
            {degrees(step.temperatureF)}
          </span>
          <span className={styles.chance}>
            {chance(step.precipitationChancePct)}
          </span>
        </li>
      ))}
    </ol>
  </section>
);

export default NextHours;
