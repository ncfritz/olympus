import {
  AlternativeName,
  AlternativeTitle,
  BaseImage,
  ExternalId,
  IdentifiableImage,
  TypedImage,
  Video,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlAlternativeName,
  GraphQlAlternativeTitle,
  GraphQlExternalId,
  GraphQlIdentifiableImage,
  GraphQlImage,
  GraphQlTypedImage,
  GraphQlVideo,
} from "../types/metadata";
import { toDomainObject as toCountryDomainObject } from "../countries/converters/CountryConverter";
import { toDomainObject as toLanguageDomainObject } from "../languages/converters/LanguageConverter";

export const toExternalIdDomainObject = (
  input: GraphQlExternalId,
): ExternalId => {
  return {
    createdTime: moment(input.createdTime),
    externalId: input.externalId,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    type: input.type,
  };
};

export const toAlternativeTitleDomainObject = (
  input: GraphQlAlternativeTitle,
): AlternativeTitle => {
  return {
    country: input.country ? toCountryDomainObject(input.country) : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    title: input.title,
    type: input.type,
  };
};

export const toAlternativeNameDomainObject = (
  input: GraphQlAlternativeName,
): AlternativeName => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    type: input.type,
  };
};

export const toVideoDomainObject = (input: GraphQlVideo): Video => {
  return {
    createdTime: moment(input.createdTime),
    country: input.country ? toCountryDomainObject(input.country) : undefined,
    type: input.type,
    key: input.key,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    id: input.id,
    official: input.official,
    publishedTime: moment(input.publishedDate),
    site: input.site,
    size: input.size,
    language: input.language
      ? toLanguageDomainObject(input.language)
      : undefined,
  };
};

export const toBaseImageDomainObject = (input: GraphQlImage): BaseImage => {
  return {
    createdTime: moment(input.createdTime),
    filePath: input.filePath,
    height: input.height,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    width: input.width,
  };
};

export const toTypedImageDomainObject = (
  input: GraphQlTypedImage,
): TypedImage => {
  return {
    ...toBaseImageDomainObject(input),
    type: input.type,
    language: input.language
      ? toLanguageDomainObject(input.language)
      : undefined,
  };
};

export const toIdentifiableImageDomainObject = (
  input: GraphQlIdentifiableImage,
): IdentifiableImage => {
  return {
    ...toBaseImageDomainObject(input),
    id: input.id,
    fileType: input.fileType,
  };
};
