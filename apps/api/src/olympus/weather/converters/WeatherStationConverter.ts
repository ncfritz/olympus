import {
  WeatherArchiveRecordSource,
  WeatherStation,
  WeatherStationReading,
} from "@ncfritz/olympus-model";
import moment, { type Moment } from "moment";

/** A sample as Hasura returns it (custom column names; nulls for no value). */
export type GraphQlWeatherStationReading = {
  observedTime: string;
  source: string;
} & Record<string, number | boolean | string | null>;

/** A `weather_stations` row as Hasura returns it (custom column names). */
export type GraphQlWeatherStation = {
  id: string;
  name: string;
  /** Postgres writes a macaddr in lower case with colons. */
  macAddress: string;
  createdTime: string;
  lastUpdatedTime: string | null;
  /** With WEATHER_STATION_WITH_LATEST: the newest sample, if any. */
  samples?: GraphQlWeatherStationReading[];
};

/** What says whether a station is reporting. */
export type ReportingContext = { now: Moment; staleSeconds: number };

export const toDomainObject = (
  input: GraphQlWeatherStation,
  context?: ReportingContext,
): WeatherStation => {
  const station: WeatherStation = {
    id: input.id,
    name: input.name,
    macAddress: input.macAddress.toUpperCase(),
    createdTime: moment(input.createdTime),
    lastUpdatedTime: input.lastUpdatedTime
      ? moment(input.lastUpdatedTime)
      : undefined,
  };
  if (input.samples === undefined || !context) return station;
  const latest = input.samples[0];
  station.latestReading = latest ? toReading(latest) : undefined;
  station.reporting =
    latest !== undefined &&
    context.now.diff(moment(latest.observedTime), "seconds") <=
      context.staleSeconds;
  return station;
};

/** A sample as a reading: nulls left out. */
export const toReading = (
  input: GraphQlWeatherStationReading,
): WeatherStationReading => {
  const { observedTime, source, ...values } = input;
  const reading: WeatherStationReading = {
    observedTime: moment(observedTime),
    source:
      source === "backfill"
        ? WeatherArchiveRecordSource.Backfill
        : WeatherArchiveRecordSource.Push,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) {
      (reading as unknown as Record<string, unknown>)[name] = value;
    }
  }
  return reading;
};
