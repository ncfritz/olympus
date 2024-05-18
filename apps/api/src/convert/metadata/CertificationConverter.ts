import { Certification } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlCertification } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlCertification): Certification => {
  return {
    country: input.country,
    certification: input.certification,
    type: input.type,
    order: input.order,
    meaning: input.meaning,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
