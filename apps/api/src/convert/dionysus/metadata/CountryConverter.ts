import { Country, CountryAssociation } from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlCountry,
  GraphQlCountryWrapper,
} from "../../../types/dionysus/metadata/country";

export const toDomainObject = (input: GraphQlCountry): Country => {
  return {
    id: input.id,
    name: input.name,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toCountryAssociationDomainObject = (
  input: GraphQlCountryWrapper,
): CountryAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    country: toDomainObject(input.country),
  };
};
