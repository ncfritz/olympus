import { Country } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlCountry } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlCountry): Country => {
  return {
    id: input.id,
    name: input.name,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
