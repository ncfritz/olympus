import { Keyword } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlKeyword } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlKeyword): Keyword => {
  return {
    id: input.id,
    value: input.value,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
