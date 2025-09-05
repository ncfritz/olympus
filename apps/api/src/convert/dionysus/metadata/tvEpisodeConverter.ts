import {
  Episode,
  ExternalId,
  SparseEpisode,
  TVEpisodeCastMember,
  TVEpisodeCrewMember,
  TypedImage,
  Video,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlSparseTvEpisode,
  GraphQlTvEpisode,
  GraphQlTvEpisodeCastMember,
  GraphQlTvEpisodeCrewMember,
} from "../../../types/dionysus/metadata/tvEpisode";
import {
  toExternalIdDomainObject,
  toTypedImageDomainObject,
  toVideoDomainObject,
} from "./common";
import { toBaseDomainObject as toTvSeriesDomainObject } from "./tvSeriesConverter";
import { toSparseDomainObject as toSeasonDomainObject } from "./tvSeasonConverter";
import { toBaseDomainObject as toPersonDomainObject } from "./PersonConverter";

export const toSparseDomainObject = (
  input: GraphQlSparseTvEpisode,
): SparseEpisode => {
  return {
    airDate: input.airDate ? moment(input.airDate) : undefined,
    createdTime: moment(input.createdTime),
    episodeNumber: input.episodeNumber,
    id: input.id,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    overview: input.overview,
    productionCode: input.productionCode,
    runtime: input.runtime,
    stillPath: input.stillPath,
    seasonNumber: input.seasonNumber,
    voteCount: input.voteCount,
    voteAverage: input.voteAverage,
  };
};

export const toDomainObject = (input: GraphQlTvEpisode): Episode => {
  const externalIds: ExternalId[] = [];
  const images: TypedImage[] = [];
  const videos: Video[] = [];

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

  return {
    ...toSparseDomainObject(input),
    series: toTvSeriesDomainObject(input.series),
    season: toSeasonDomainObject(input.season),
    externalIds: externalIds,
    images: images,
    videos: videos,
  };
};

export const toTvEpisodeCastMember = (
  input: GraphQlTvEpisodeCastMember,
): TVEpisodeCastMember => {
  return {
    creditId: input.creditId,
    character: input.character,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    order: input.order,
    originalName: input.originalName,
    person: toPersonDomainObject(input.person),
  };
};

export const toTvEpisodeCrewMember = (
  input: GraphQlTvEpisodeCrewMember,
): TVEpisodeCrewMember => {
  return {
    creditId: input.creditId,
    job: input.job,
    department: input.department,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    originalName: input.originalName,
    person: toPersonDomainObject(input.person),
  };
};
