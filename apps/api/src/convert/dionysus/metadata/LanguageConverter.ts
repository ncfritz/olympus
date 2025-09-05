import { Language, LanguageAssociation } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import {
  GraphQlLanguage,
  GraphQlLanguageWrapper,
} from "../../../types/dionysus/metadata/language";

export const toDomainObject = (input: GraphQlLanguage): Language => {
  return {
    id: input.id,
    name: input.name,
    nativeName: input.nativeName,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toLanguageAssociationDomainObject = (
  input: GraphQlLanguageWrapper,
): LanguageAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    language: toDomainObject(input.language),
  };
};
