import { Country, MovieProductionCountry } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlCountry, GraphQlCountryWrapper } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlCountry): Country => {
  return {
    id: input.id,
    name: input.name,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toMovieCountryDomainObject = (
  input: GraphQlCountryWrapper,
): MovieProductionCountry => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    country: toDomainObject(input.country),
  };
};
