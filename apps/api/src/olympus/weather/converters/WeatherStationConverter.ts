import { WeatherStation } from "@ncfritz/olympus-model";
import moment from "moment";

/** A `weather_stations` row as Hasura returns it (custom column names). */
export type GraphQlWeatherStation = {
  id: string;
  name: string;
  /** Postgres writes a macaddr in lower case with colons. */
  macAddress: string;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export const toDomainObject = (
  input: GraphQlWeatherStation,
): WeatherStation => ({
  id: input.id,
  name: input.name,
  macAddress: input.macAddress.toUpperCase(),
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
