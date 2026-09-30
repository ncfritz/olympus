import {
  type WeatherStation,
  type WeatherStationSeries,
} from "@ncfritz/olympus-sdk/olympus";
import { useEffect, useState } from "react";
import weatherApi from "../../../api/weatherApi";
import { ago, lowHigh, stationTiles, tenths } from "../../../utils/stations";
import { formatClock } from "../../../utils/weather";
import Sparkline from "./Sparkline";
import styles from "./WeatherWidget.module.css";

export interface StationCardProps {
  station: WeatherStation;
  /** The clock the "ago" and the sparkline's range are measured against. */
  now: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The sparkline is 15-minute buckets; new ones every 15 minutes. */
const SERIES_REFRESH_MS = 5 * 60 * 1000;
const RESOLUTION = "15m";
const BUCKET_MS = 15 * 60 * 1000;

/**
 * One station: whether it is reporting, the outdoor temperature with the
 * last 24 hours as a sparkline, and twelve readings (the design's
 * Stations.dc.html).
 */
const StationCard: React.FunctionComponent<StationCardProps> = ({
  station,
  now,
}: StationCardProps) => {
  const [series, setSeries] = useState<WeatherStationSeries | undefined>();
  const [range, setRange] = useState({ from: now - DAY_MS, to: now });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const to = Date.now();
      const from = to - DAY_MS;
      try {
        const [temperature] = await weatherApi.stationSeries(
          station.id,
          ["outdoor_temperature"],
          new Date(from),
          new Date(to),
          RESOLUTION,
        );
        if (!cancelled) {
          setSeries(temperature);
          setRange({ from, to });
        }
      } catch {
        // The sparkline keeps what it had; the card's reading still shows.
      }
    };
    void load();
    const timer = setInterval(() => void load(), SERIES_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [station.id]);

  const reading = station.latestReading;
  const extremes = series ? lowHigh(series.points) : undefined;
  const offset = -new Date().getTimezoneOffset() * 60;

  return (
    <section className={styles.station} aria-label={station.name}>
      <div className={styles.stationHeader}>
        <h3 className={styles.stationName}>{station.name}</h3>
        <span className={styles.muted}>
          <span
            className={
              station.reporting ? styles.reporting : styles.notReporting
            }
            aria-hidden
          />{" "}
          {station.reporting
            ? `Reporting · ${ago(reading!.observedTime, now)}`
            : reading
              ? `Not reporting · last reading ${formatClock(reading.observedTime, offset)}`
              : "Not reporting"}
        </span>
      </div>

      {reading ? (
        <>
          <div className={styles.stationNow}>
            <div className={styles.stationTemperature}>
              <span className={styles.muted}>Outdoor</span>
              <span className={styles.nowTemperature}>
                {tenths(reading.outdoorTemperatureF)}
              </span>
            </div>
            <div className={styles.spark}>
              <Sparkline
                points={(series?.points ?? []).map((point) => ({
                  time: point.time,
                  value: point.mean,
                }))}
                from={range.from}
                to={range.to}
                maxGapMs={2 * BUCKET_MS}
                label="Outdoor temperature, last 24 hours"
              />
              <div className={styles.sparkAxis}>
                <span>24 h ago</span>
                <span>
                  {extremes
                    ? `low ${tenths(extremes.low)} · high ${tenths(extremes.high)}`
                    : ""}
                </span>
                <span>now</span>
              </div>
            </div>
          </div>
          <div className={styles.tiles}>
            {stationTiles(reading).map((tile) => (
              <div key={tile.label} className={styles.stat}>
                <span className={styles.muted}>{tile.label}</span>
                <span className={styles.statValue}>{tile.value}</span>
              </div>
            ))}
          </div>
          {reading.source === "backfill" && (
            <span className={styles.muted}>
              From ambientweather.net: pushes have not arrived since.
            </span>
          )}
        </>
      ) : (
        <span className={styles.muted}>No readings in the last two days.</span>
      )}
    </section>
  );
};

export default StationCard;
