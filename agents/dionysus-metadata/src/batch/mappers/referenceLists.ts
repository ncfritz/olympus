import type {
  CertificationType,
  GenreType,
  PartialCertification,
  PartialGenre,
} from "@ncfritz/olympus-sdk/dionysus";
import type { Certifications } from "tmdb-ts";
import type { Genres } from "tmdb-ts/dist/endpoints";

/** TMDB's certifications (by country) as the API's certifications. */
export const toCertifications = (
  response: Certifications,
  type: CertificationType,
): PartialCertification[] => {
  const records: PartialCertification[] = [];

  for (const country in response.certifications) {
    // @ts-expect-error external api
    for (const certification of response.certifications[country]) {
      records.push({
        country: country,
        type: type,
        certification: certification.certification,
        order: certification.order,
        meaning: certification.meaning,
      });
    }
  }

  return records;
};

/** TMDB's genres as the API's genres. */
export const toGenres = (response: Genres, type: GenreType): PartialGenre[] =>
  response.genres.map((genre) => ({
    id: genre.id,
    name: genre.name,
    type: type,
  }));
