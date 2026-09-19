import {
  GraphQlAlternativeName,
  GraphQlIdentifiableImage,
  Timestamped,
  Wrapped,
} from "../../types/metadata";
import { GraphQlCountry } from "../../countries/types/country";

export type GraphQlSparseProductionCompany = Timestamped & {
  alternativeNames: GraphQlAlternativeName[];
  country: GraphQlCountry;
  description: string;
  headquarters: string;
  homepage: string;
  id: number;
  logo: string;
  name: string;
};

export type GraphQlSparseProductionCompanyWithContentCounts =
  GraphQlSparseProductionCompany & {
    movies_aggregate: {
      aggregate: {
        count: number;
      };
    };
    tvSeries_aggregate: {
      aggregate: {
        count: number;
      };
    };
  };

export type GraphQlProductionCompany = GraphQlSparseProductionCompany & {
  logos: GraphQlIdentifiableImage[];
};

export type GraphQlFullProductionCompany = GraphQlProductionCompany & {
  parent?: GraphQlSparseProductionCompany;
  children: GraphQlSparseProductionCompanyWithContentCounts[];
};

export type GraphQlProductionCompanyWrapper = Timestamped &
  Wrapped<GraphQlSparseProductionCompany, "productionCompany">;
