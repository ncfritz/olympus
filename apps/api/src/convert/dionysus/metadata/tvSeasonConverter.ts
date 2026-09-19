import {
  ExternalId,
  Season,
  SparseEpisode,
  SparseSeason,
  TypedImage,
  Video,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlSparseTvSeason,
  GraphQlTvSeason,
} from "../../../types/dionysus/metadata/tvSeason";
import { toDomainObject as toSearchConfigurationDomainObject } from "../media/MediaAssetSearchConfigurationConverter";
import { toSparseDomainObject as toMediaFavoriteDomainObject } from "../media/MediaFavoriteConverter";
import {
  toExternalIdDomainObject,
  toTypedImageDomainObject,
  toVideoDomainObject,
} from "./common";
import { toSparseDomainObject as toEpisodeDomainObject } from "./tvEpisodeConverter";
import { toBaseDomainObject as toSeriesDomainObject } from "./tvSeriesConverter";

export const toSparseDomainObject = (
  input: GraphQlSparseTvSeason,
): SparseSeason => {
  return {
    airDate: input.airDate ? moment(input.airDate) : undefined,
    createdTime: moment(input.createdTime),
    id: input.id,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    overview: input.overview,
    posterPath: input.posterPath,
    seasonNumber: input.seasonNumber,
    voteAverage: input.voteAverage,
    episodeCount: input.episodes_aggregate.aggregate.count,
    searchConfiguration: input.searchConfiguration
      ? toSearchConfigurationDomainObject(input.searchConfiguration)
      : undefined,
    favorite: input.favorite
      ? toMediaFavoriteDomainObject(input.favorite)
      : undefined,
  };
};

export const toDomainObject = (input: GraphQlTvSeason): Season => {
  const externalIds: ExternalId[] = [];
  const images: TypedImage[] = [];
  const videos: Video[] = [];
  const episodes: SparseEpisode[] = [];

  if (input.externalIds) {
    input.externalIds.forEach((entity) => {
      externalIds.push(toExternalIdDomainObject(entity));
    });
  }

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toTypedImageDomainObject(entity));
    });
  }

  if (input.videos) {
    input.videos.forEach((entity) => {
      videos.push(toVideoDomainObject(entity));
    });
  }

  if (input.episodes) {
    input.episodes.forEach((entity) => {
      episodes.push(toEpisodeDomainObject(entity));
    });
  }

  return {
    ...toSparseDomainObject(input),
    series: input.series ? toSeriesDomainObject(input.series) : undefined,
    externalIds: externalIds,
    images: images,
    videos: videos,
    episodes: episodes,
  };
};
