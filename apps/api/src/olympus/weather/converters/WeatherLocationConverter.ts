import { WeatherLocation } from "@ncfritz/olympus-model";
import moment from "moment";

/** A `weather_locations` row as Hasura returns it (custom column names). */
export type GraphQlWeatherLocation = {
  id: string;
  label: string;
  placeId: string | null;
  placeName: string | null;
  latitude: number;
  longitude: number;
  position: number;
  isDefault: boolean;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export const toDomainObject = (
  input: GraphQlWeatherLocation,
): WeatherLocation => ({
  id: input.id,
  label: input.label,
  placeId: input.placeId ?? undefined,
  placeName: input.placeName ?? undefined,
  latitude: input.latitude,
  longitude: input.longitude,
  position: input.position,
  isDefault: input.isDefault,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
