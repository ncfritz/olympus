import { Timestamped, Wrapped } from "../../types/metadata";

export type GraphQlCountry = {
  createdTime: string;
  id: string;
  lastUpdatedTime: string;
  name: string;
};

export type GraphQlCountryWrapper = Timestamped &
  Wrapped<GraphQlCountry, "country">;
