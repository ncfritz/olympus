import { Timestamped, Wrapped } from "../metadata";

export type GraphQlCountry = {
  createdTime: string;
  id: string;
  lastUpdatedTime: string;
  name: string;
};

export type GraphQlCountryWrapper = Timestamped &
  Wrapped<GraphQlCountry, "country">;
