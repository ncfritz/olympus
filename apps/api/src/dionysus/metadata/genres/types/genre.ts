import { GenreType } from "@ncfritz/olympus-model";
import { Timestamped, Wrapped } from "../../types/metadata";

export type GraphQlGenre = {
  id: number;
  type: GenreType;
  name: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlGenreWrapper = Timestamped & Wrapped<GraphQlGenre, "genre">;
