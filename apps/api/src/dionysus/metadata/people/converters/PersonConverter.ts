import {
  BasePerson,
  ExternalId,
  Gender,
  IdentifiableImage,
  Person,
  PersonAlsoKnownAs,
  PersonAssociation,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlAlsoKnownAs,
  GraphQlBasePerson,
  GraphQlPerson,
  GraphQlPersonWrapper,
} from "../types/person";
import {
  toExternalIdDomainObject,
  toIdentifiableImageDomainObject,
} from "../../converters/common";

export const toBaseDomainObject = (input: GraphQlBasePerson): BasePerson => {
  return {
    adult: input.adult,
    birthday: input.birthday ? moment(input.birthday) : undefined,
    birthplace: input.birthplace,
    createdTime: moment(input.createdTime),
    deathday: input.deathday ? moment(input.deathday) : undefined,
    gender: getGender(input.gender),
    homepage: input.homepage,
    id: input.id,
    imdbId: input.imdbId,
    knownForDepartment: input.knownForDepartment,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    profilePath: input.profilePath,
    popularity: input.popularity,
  };
};

export const toDomainObject = (input: GraphQlPerson): Person => {
  const alsoKnownAs: PersonAlsoKnownAs[] = [];
  const externalIds: ExternalId[] = [];
  const images: IdentifiableImage[] = [];

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
      images.push(toIdentifiableImageDomainObject(entity));
    });
  }

  return {
    ...toBaseDomainObject(input),
    alsoKnownAs: alsoKnownAs,
    biography: input.biography,
    externalIds: externalIds,
    images: images,
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

export const toPersonAssociationDomainObject = (
  input: GraphQlPersonWrapper,
): PersonAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    person: toDomainObject(input.person),
  };
};
