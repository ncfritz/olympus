import type {
  Gender,
  PartialBaseImage,
  PartialExternalId,
  PartialPerson,
  PartialPersonAlsoKnownAs,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import { PEOPLE_ID_TYPES } from "./externalIds";
import { UniqueSet } from "./UniqueSet";
import type { TmdbClient } from "../../tmdb/services/TmdbClient";

/** Maps TMDB's responses for a person to the API entity. */
export const toPerson = (
  personResponse: Awaited<ReturnType<TmdbClient["getPersonDetails"]>>,
): PartialPerson => {
  const alsoKnownAs: UniqueSet<PartialPersonAlsoKnownAs> = new UniqueSet();

  personResponse.also_known_as.forEach((value) => {
    alsoKnownAs.add({
      name: value,
    });
  });

  const images: UniqueSet<PartialBaseImage> = new UniqueSet();

  if (personResponse.images?.profiles) {
    personResponse.images.profiles.forEach((value) => {
      images.add({
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1,
      });
    });
  }

  const externalIds: UniqueSet<PartialExternalId> = new UniqueSet();

  if (personResponse.external_ids) {
    Object.entries(PEOPLE_ID_TYPES).forEach(([idType, idName]) => {
      if (personResponse.external_ids[idType as never]) {
        externalIds.add({
          type: idName,
          externalId: `${personResponse.external_ids[idType as never]}`,
        });
      }
    });
  }

  const person: PartialPerson = {
    id: personResponse.id,
    name: personResponse.name,
    adult: personResponse.adult,
    biography: personResponse.biography,
    birthday: personResponse.birthday
      ? moment(personResponse.birthday).toISOString()
      : undefined,
    birthplace: personResponse.place_of_birth,
    deathday: personResponse.deathday
      ? moment(personResponse.deathday).toISOString()
      : undefined,
    gender: personResponse.gender as Gender,
    homepage: personResponse.homepage,
    imdbId: personResponse.imdb_id,
    knownForDepartment: personResponse.known_for_department,
    profilePath: personResponse.profile_path,
    popularity: personResponse.popularity,
    alsoKnownAs: [...alsoKnownAs],
    images: [...images],
    externalIds: [...externalIds],
  };

  return person;
};
