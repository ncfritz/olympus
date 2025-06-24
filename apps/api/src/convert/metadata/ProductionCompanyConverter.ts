import {
  MovieProductionCompany,
  ProductionCompanyAlternativeName,
  SparseProductionCompany,
} from "@ncfritz/olympus-model";
import moment from "moment";
import { toDomainObject as toCountryDomainObject } from "./CountryConverter";
import {
  GraphQlMovieProductionCompanyWrapper,
  GraphQlProductionCompanyBase,
} from "../../types/dionysus/metadata";

export const toSparseBaseDomainObject = (
  input: GraphQlProductionCompanyBase,
): SparseProductionCompany => {
  const alternativeNames: ProductionCompanyAlternativeName[] = [];

  if (input.alternativeNames) {
    input.alternativeNames.forEach((entity) => {
      alternativeNames.push({
        createdTime: moment(input.createdTime),
        lastUpdatedTime: moment(input.lastUpdatedTime),
        name: entity.name,
        type: entity.type,
      });
    });
  }

  return {
    alternativeNames: alternativeNames,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    description: input.description,
    homepage: input.homepage,
    headquarters: input.headquarters,
    name: input.name,
    logoPath: input.logo,
    originCountry: input.country
      ? toCountryDomainObject(input.country)
      : undefined,
    id: input.id,
  };
};

export const toMovieProductionCompanyDomainObject = (
  input: GraphQlMovieProductionCompanyWrapper,
): MovieProductionCompany => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    productionCompany: toSparseBaseDomainObject(input.productionCompany),
  };
};
