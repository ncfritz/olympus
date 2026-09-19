import type {
  PartialCollection,
  PartialCollectionPart,
  PartialTypedImage,
} from "@ncfritz/olympus-sdk/dionysus";
import type { TmdbClient } from "../../tmdb/services/TmdbClient";

/** Maps TMDB's responses for a collection to the API entity. */
export const toCollection = (
  collectionResponse: Awaited<ReturnType<TmdbClient["getCollectionDetails"]>>,
  collectionImagesResponse: Awaited<
    ReturnType<TmdbClient["getCollectionImages"]>
  >,
): PartialCollection => {
  const parts: PartialCollectionPart[] = [];

  collectionResponse.parts.forEach((value) => {
    if (!parts.some((e) => e.movieId === value.id)) {
      parts.push({
        movieId: value.id,
      });
    }
  });

  const images: PartialTypedImage[] = [];

  collectionImagesResponse.posters.forEach((value) => {
    const candidate = {
      type: "poster",
      filePath: value.file_path,
      width: value.width,
      height: value.height,
      languageCode: value.iso_639_1 || "en",
    };

    if (
      !images.some(
        (e) =>
          e.type === "poster" &&
          e.languageCode === candidate.languageCode &&
          e.filePath === value.file_path,
      )
    ) {
      images.push(candidate);
    }
  });

  const collection: PartialCollection = {
    id: collectionResponse.id,
    name: collectionResponse.name,
    overview: collectionResponse.overview,
    posterPath: collectionResponse.poster_path,
    backdropPath: collectionResponse.backdrop_path,
    parts: parts,
    images: images,
  };

  collectionImagesResponse.backdrops.forEach((value) => {
    const candidate = {
      type: "backdrop",
      filePath: value.file_path,
      width: value.width,
      height: value.height,
      languageCode: value.iso_639_1 || "en",
    };

    if (
      !images.some(
        (e) =>
          e.type === "backdrop" &&
          e.languageCode === candidate.languageCode &&
          e.filePath === value.file_path,
      )
    ) {
      images.push(candidate);
    }
  });

  return collection;
};
