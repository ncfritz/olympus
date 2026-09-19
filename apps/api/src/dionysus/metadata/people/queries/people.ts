import { BASE_IMAGE, EXTERNAL_IDS } from "../../queries/common";

export const BASE_PERSON = `id
  name
  adult
  birthday
  birthplace
  deathday
  gender
  homepage
  imdbId
  knownForDepartment
  profilePath
  popularity
  createdTime
  lastUpdatedTime`;

export const BASE_PERSON_ALSO_KNOWN_AS = `name
  createdTime
  lastUpdatedTime`;

export const PERSON_ALSO_KNOWN_AS = `alsoKnownAs {
    ${BASE_PERSON_ALSO_KNOWN_AS}
  }`;

export const PERSON = `${BASE_PERSON}
  biography
  ${EXTERNAL_IDS}
  ${PERSON_ALSO_KNOWN_AS}
  images {
    ${BASE_IMAGE}
  }`;
