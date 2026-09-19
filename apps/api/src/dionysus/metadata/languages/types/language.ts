import { Timestamped, Wrapped } from "../../types/metadata";

export type GraphQlLanguage = {
  id: string;
  name: string;
  nativeName: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlLanguageWrapper = Timestamped &
  Wrapped<GraphQlLanguage, "language">;
