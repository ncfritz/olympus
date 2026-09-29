import { type CurrentWeather } from "@ncfritz/olympus-sdk/olympus";
import { compassPoint, degrees, formatClock } from "../../../utils/weather";
import ConditionIcon from "./ConditionIcon";
import styles from "./WeatherWidget.module.css";

export interface CurrentConditionsProps {
  current: CurrentWeather;
  utcOffsetSeconds: number;
  /** When the forecast was fetched from the provider. */
  fetchedTime: string;
}

/** Now: the big reading, four details, and when it was fetched. */
const CurrentConditions: React.FunctionComponent<CurrentConditionsProps> = ({
  current,
  utcOffsetSeconds,
  fetchedTime,
}: CurrentConditionsProps) => {
  const at = (iso: string) => formatClock(iso, utcOffsetSeconds);
  return (
    <section className={styles.section} aria-label="Now">
      <div className={styles.nowRow}>
        <ConditionIcon
          kind={current.conditionKind}
          isDaytime={current.isDaytime}
          label={current.condition}
          size={64}
        />
        <div>
          <div className={styles.nowRow}>
            <span className={styles.nowTemperature}>
              {degrees(current.temperatureF)}
            </span>
            <span className={styles.nowCondition}>{current.condition}</span>
          </div>
          <div className={styles.muted}>
            Feels like {degrees(current.feelsLikeF)} · High{" "}
            {degrees(current.highF)} · Low {degrees(current.lowF)}
          </div>
        </div>
      </div>
      <div className={styles.stats}>
        <Stat
          name="Wind"
          value={`${compassPoint(current.windDirectionDeg)} ${Math.round(current.windSpeedMph)} mph`}
          detail={
            current.windGustMph !== undefined
              ? `gusts ${Math.round(current.windGustMph)}`
              : "no gusts"
          }
        />
        <Stat
          name="Humidity"
          value={`${current.humidityPct}%`}
          detail={`dew pt ${degrees(current.dewPointF)}`}
        />
        <Stat
          name="Pressure"
          value={`${current.pressureInHg.toFixed(2)} in`}
          detail={`${current.pressureHpa} hPa`}
        />
        <Stat
          name="Visibility"
          value={
            current.visibilityMi !== undefined
              ? `${current.visibilityMi} mi`
              : "—"
          }
          detail={`clouds ${current.cloudCoverPct}%`}
        />
      </div>
      <div className={styles.muted}>
        Updated {at(fetchedTime)} · sunrise {at(current.sunriseTime)} · sunset{" "}
        {at(current.sunsetTime)}
      </div>
    </section>
  );
};

const Stat = ({
  name,
  value,
  detail,
}: {
  name: string;
  value: string;
  detail: string;
}) => (
  <div className={styles.stat}>
    <span className={styles.muted}>{name}</span>
    <span className={styles.statValue}>{value}</span>
    <span className={styles.muted}>{detail}</span>
  </div>
);

export default CurrentConditions;
