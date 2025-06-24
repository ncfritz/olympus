import { Language, MovieSpokenLanguage } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlLanguage, GraphQlLanguageWrapper } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlLanguage): Language => {
  return {
    id: input.id,
    name: input.name,
    nativeName: input.nativeName,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toMovieSpokenLanguageDomainObject = (
  input: GraphQlLanguageWrapper,
): MovieSpokenLanguage => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    language: toDomainObject(input.language),
  };
};