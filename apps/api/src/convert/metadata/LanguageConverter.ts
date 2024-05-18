import { Language } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlLanguage } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlLanguage): Language => {
  return {
    id: input.id,
    name: input.name,
    nativeName: input.nativeName,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
