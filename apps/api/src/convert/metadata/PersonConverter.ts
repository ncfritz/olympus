import {
  Gender,
  Person,
  PersonAlsoKnownAs,
  PersonExternalId,
  PersonImage,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlAlsoKnownAs,
  GraphQlExternalId,
  GraphQlImage,
  GraphQlPerson,
} from "../../types/dionysus/metadata";
import { toDomainObject as toLanguageDomainObject } from "./LanguageConverter";

export const toDomainObject = (input: GraphQlPerson): Person => {
  const alsoKnownAs: PersonAlsoKnownAs[] = [];
  const externalIds: PersonExternalId[] = [];
  const images: PersonImage[] = [];

  if (input.alsoKnownAs) {
    input.alsoKnownAs.forEach((entity) => {
      alsoKnownAs.push(toAlsoKnownAsDomainObject(entity));
    });
  }

  if (input.externalIds) {
    input.externalIds.forEach((entity) => {
      externalIds.push(toExternalIdDomainObject(entity));
    });
  }

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toImageDomainObject(entity));
    });
  }

  return {
    adult: input.adult,
    alsoKnownAs: alsoKnownAs,
    biography: input.biography,
    birthday: input.birthday ? moment(input.birthday) : undefined,
    birthplace: input.birthplace,
    createdTime: moment(input.createdTime),
    deathday: input.deathday ? moment(input.deathday) : undefined,
    externalIds: externalIds,
    gender: getGender(input.gender),
    homepage: input.homepage,
    id: input.id,
    images: images,
    imdbId: input.imdbId,
    knownForDepartment: input.knownForDepartment,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    profilePath: input.profilePath,
  };
};

const getGender = (input: number): Gender => {
  switch (input) {
    case 1:
      return Gender.FEMALE;
    case 2:
      return Gender.MALE;
    case 3:
      return Gender.NON_BINARY;
    default:
      return Gender.UNKNOWN;
  }
};

export const toAlsoKnownAsDomainObject = (
  input: GraphQlAlsoKnownAs,
): PersonAlsoKnownAs => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
  };
};

export const toExternalIdDomainObject = (
  input: GraphQlExternalId,
): PersonExternalId => {
  return {
    createdTime: moment(input.createdTime),
    externalId: input.externalId,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    type: input.type,
  };
};

export const toImageDomainObject = (input: GraphQlImage): PersonImage => {
  return {
    createdTime: moment(input.createdTime),
    filePath: input.filePath,
    height: input.height,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    width: input.width,
    language: input.language
      ? toLanguageDomainObject(input.language)
      : undefined,
  };
};
