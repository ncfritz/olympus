import { Collection, CollectionPart, TypedImage } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlCollection, GraphQlCollectionPart } from "../../types/metadata";
import { toTypedImageDomainObject } from "../../converters/common";
import { toSparseDomainObject as toSparseMovieDomainObject } from "../../movies/converters/MovieConverter";

export const toDomainObject = (input: GraphQlCollection): Collection => {
  const images: TypedImage[] = [];
  const parts: CollectionPart[] = [];

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toTypedImageDomainObject(entity));
    });
  }

  if (input.parts) {
    input.parts.forEach((entity) => {
      if (entity.movie) {
        parts.push(toCollectionPartDomainObject(entity));
      }
    });
  }

  return {
    backdropPath: input.backdropPath,
    createdTime: moment(input.createdTime),
    id: input.id,
    name: input.name,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    overview: input.overview,
    posterPath: input.posterPath,
    images: images,
    parts: parts,
  };
};

const toCollectionPartDomainObject = (
  input: GraphQlCollectionPart,
): CollectionPart => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    movie: toSparseMovieDomainObject(input.movie),
  };
};
