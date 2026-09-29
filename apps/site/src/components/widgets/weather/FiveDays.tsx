import { type ForecastDay } from "@ncfritz/olympus-sdk/olympus";
import {
  chance,
  dayLabel,
  degrees,
  rangeBars,
  temperatureGradient,
} from "../../../utils/weather";
import ConditionIcon from "./ConditionIcon";
import styles from "./WeatherWidget.module.css";

export interface FiveDaysProps {
  days: ForecastDay[];
}

/** Five local days, each low-to-high bar on one scale shared by all. */
const FiveDays: React.FunctionComponent<FiveDaysProps> = ({
  days,
}: FiveDaysProps) => {
  const bars = rangeBars(days);
  return (
    <section className={styles.section} aria-labelledby="weather-days">
      <h3 id="weather-days" className={styles.sectionTitle}>
        5 days
      </h3>
      <ol>
        {days.map((day, index) => (
          <li key={day.date} className={styles.day}>
            <span className={styles.dayName}>{dayLabel(day.date, index)}</span>
            <ConditionIcon
              kind={day.conditionKind}
              label={day.condition}
              size={22}
            />
            <span className={styles.dayChance}>
              {chance(day.precipitationChancePct)}
            </span>
            <span className={styles.dayLow}>{degrees(day.lowF)}</span>
            <span
              className={styles.track}
              role="img"
              aria-label={`Low ${degrees(day.lowF)}, high ${degrees(day.highF)}`}
            >
              <span
                className={styles.bar}
                // Computed from data: where the bar sits on the shared
                // scale, and its low-to-high temperature colours.
                style={{
                  left: `${bars[index].left}%`,
                  width: `${bars[index].width}%`,
                  background: temperatureGradient(day.lowF, day.highF),
                }}
              />
            </span>
            <span className={styles.dayHigh}>{degrees(day.highF)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default FiveDays;
