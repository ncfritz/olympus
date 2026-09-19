import {
  AlternativeName,
  FullProductionCompany,
  IdentifiableImage,
  ProductionCompanyAssociation,
  SparseProductionCompany,
  SparseProductionCompanyWithContentCounts,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlFullProductionCompany,
  GraphQlProductionCompanyWrapper,
  GraphQlSparseProductionCompany,
  GraphQlSparseProductionCompanyWithContentCounts,
} from "../types/productionCompany";
import {
  toAlternativeNameDomainObject,
  toIdentifiableImageDomainObject,
} from "../../converters/common";
import { toDomainObject as toCountryDomainObject } from "../../countries/converters/CountryConverter";

export const toSparseDomainObject = (
  input: GraphQlSparseProductionCompany,
): SparseProductionCompany => {
  const alternativeNames: AlternativeName[] = [];

  if (input.alternativeNames) {
    input.alternativeNames.forEach((entity) => {
      if (entity) {
        alternativeNames.push(toAlternativeNameDomainObject(entity));
      }
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

export const toSparseDomainObjectWithContentCounts = (
  input: GraphQlSparseProductionCompanyWithContentCounts,
): SparseProductionCompanyWithContentCounts => {
  return {
    ...toSparseDomainObject(input),
    moviesCount: input.movies_aggregate.aggregate.count,
    tvSeriesCount: input.tvSeries_aggregate.aggregate.count,
  };
};

export const toFullDomainObject = (
  input: GraphQlFullProductionCompany,
): FullProductionCompany => {
  const logos: IdentifiableImage[] = [];
  const children: SparseProductionCompanyWithContentCounts[] = [];

  if (input.logos) {
    input.logos.forEach((entity) => {
      logos.push(toIdentifiableImageDomainObject(entity));
    });
  }

  if (input.children) {
    input.children.forEach((entity) => {
      children.push(toSparseDomainObjectWithContentCounts(entity));
    });
  }

  return {
    ...toSparseDomainObject(input),
    parent: input.parent ? toSparseDomainObject(input.parent) : undefined,
    children: children,
    logos: logos,
  };
};

export const toProductionCompanyAssociationDomainObject = (
  input: GraphQlProductionCompanyWrapper,
): ProductionCompanyAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    productionCompany: toSparseDomainObject(input.productionCompany),
  };
};
