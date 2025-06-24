import { Keyword, MovieKeyword } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlKeyword, GraphQlKeywordWrapper } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlKeyword): Keyword => {
  return {
    id: input.id,
    value: input.value,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toMovieKeywordDomainObject = (
  input: GraphQlKeywordWrapper,
): MovieKeyword => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    keyword: toDomainObject(input.keyword),
  };
};
