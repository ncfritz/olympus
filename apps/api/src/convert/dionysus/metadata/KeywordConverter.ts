import { Keyword, KeywordAssociation } from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlKeyword,
  GraphQlKeywordWrapper,
} from "../../../types/dionysus/metadata/keyword";

export const toDomainObject = (input: GraphQlKeyword): Keyword => {
  return {
    id: input.id,
    value: input.value,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toKeywordAssociationDomainObject = (
  input: GraphQlKeywordWrapper,
): KeywordAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    keyword: toDomainObject(input.keyword),
  };
};
