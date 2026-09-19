import { Timestamped, Wrapped } from "../../types/metadata";

export type GraphQlKeyword = {
  id: string;
  value: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlKeywordWrapper = Timestamped &
  Wrapped<GraphQlKeyword, "keyword">;
