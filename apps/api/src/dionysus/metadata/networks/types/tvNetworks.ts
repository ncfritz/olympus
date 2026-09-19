import {
  GraphQlAlternativeName,
  GraphQlIdentifiableImage,
  Timestamped,
  Wrapped,
} from "../../types/metadata";
import { GraphQlCountry } from "../../countries/types/country";

export type GraphQlNetwork = Timestamped & {
  country: GraphQlCountry;
  alternativeNames: GraphQlAlternativeName[];
  headquarters: string;
  homepage: string;
  id: number;
  logo: string;
  name: string;
  images: GraphQlIdentifiableImage[];
};

export type GraphQlNetworkWithContentCounts = GraphQlNetwork & {
  tvSeries_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

export type GraphQlNetworkyWrapper = Timestamped &
  Wrapped<GraphQlNetwork, "network">;
