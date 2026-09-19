import {
  AlternativeName,
  IdentifiableImage,
  Network,
  NetworkAssociation,
  NetworkWithContentCounts,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlNetwork,
  GraphQlNetworkWithContentCounts,
  GraphQlNetworkyWrapper,
} from "../types/tvNetworks";
import {
  toAlternativeNameDomainObject,
  toIdentifiableImageDomainObject,
} from "../../converters/common";
import { toDomainObject as toCountryDomainObject } from "../../countries/converters/CountryConverter";

export const toDomainObject = (input: GraphQlNetwork): Network => {
  const alternativeNames: AlternativeName[] = [];
  const images: IdentifiableImage[] = [];

  if (input.alternativeNames) {
    input.alternativeNames.forEach((entity) => {
      if (entity) {
        alternativeNames.push(toAlternativeNameDomainObject(entity));
      }
    });
  }

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toIdentifiableImageDomainObject(entity));
    });
  }

  return {
    createdTime: moment(input.createdTime),
    headquarters: input.headquarters,
    homepage: input.homepage,
    id: input.id,
    name: input.name,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    logoPath: input.logo,
    originCountry: input.country
      ? toCountryDomainObject(input.country)
      : undefined,
    alternativeNames: alternativeNames,
    images: images,
  };
};

export const toDomainObjectWithContentCounts = (
  input: GraphQlNetworkWithContentCounts,
): NetworkWithContentCounts => {
  return {
    ...toDomainObject(input),
    tvSeriesCount: input.tvSeries_aggregate.aggregate.count,
  };
};

export const toNetworkAssociationDomainObject = (
  input: GraphQlNetworkyWrapper,
): NetworkAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    network: toDomainObject(input.network),
  };
};
