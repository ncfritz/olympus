import type {
  PartialExternalId,
  PartialSeason,
  PartialTvSeriesCastMember,
  PartialTvSeriesCrewMember,
  PartialTypedImage,
  PartialVideo,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import { AggregateCast, AggregateCrew } from "tmdb-ts";
import { TV_SEASON_ID_TYPES } from "./externalIds";
import { UniqueSet } from "./UniqueSet";
import type { TmdbClient } from "../../tmdb/services/TmdbClient";

/** Maps TMDB's responses for a TV season to the API entity. */
export const toTvSeason = (
  seasonResponse: Awaited<ReturnType<TmdbClient["getTvSeasonDetails"]>>,
): PartialSeason => {
  const cast: UniqueSet<PartialTvSeriesCastMember> = new UniqueSet();

  seasonResponse.aggregate_credits.cast.forEach((value: AggregateCast) => {
    cast.add({
      personId: value.id,
      order: value.order,
      originalName: value.original_name,
      totalEpisodeCount: value.total_episode_count,
      roles: value.roles.map((role) => {
        return {
          creditId: role.credit_id,
          character: role.character,
          episodeCount: role.episode_count,
        };
      }),
    });
  });

  const crew: UniqueSet<PartialTvSeriesCrewMember> = new UniqueSet();

  seasonResponse.aggregate_credits.crew.forEach((value: AggregateCrew) => {
    crew.add({
      personId: value.id,
      department: value.department,
      originalName: value.original_name,
      totalEpisodeCount: value.total_episode_count,
      jobs: value.jobs.map((job) => {
        return {
          creditId: job.credit_id,
          job: job.job,
          episodeCount: job.episode_count,
        };
      }),
    });
  });

  const externalIds: UniqueSet<PartialExternalId> = new UniqueSet();

  if (seasonResponse.external_ids) {
    Object.entries(TV_SEASON_ID_TYPES).forEach(([idType, idName]) => {
      if (seasonResponse.external_ids[idType as never]) {
        externalIds.add({
          type: idName,
          externalId: `${seasonResponse.external_ids[idType as never]}`,
        });
      }
    });
  }

  const images: UniqueSet<PartialTypedImage> = new UniqueSet();

  seasonResponse.images.posters.forEach((value) => {
    images.add({
      type: "poster",
      filePath: value.file_path,
      width: value.width,
      height: value.height,
      languageCode: value.iso_639_1 || "en",
    });
  });

  const videos: UniqueSet<PartialVideo> = new UniqueSet();

  seasonResponse.videos.results.forEach((value) => {
    videos.add({
      type: value.type,
      countryCode: value.iso_3166_1,
      languageCode: value.iso_639_1,
      name: value.name,
      id: value.id,
      key: value.key,
      site: value.site,
      size: value.size,
      // @ts-expect-error external api
      official: value["official"] as boolean,
      // @ts-expect-error external api
      publishedDate: moment.utc(value["published_at"]),
    });
  });

  const season: PartialSeason = {
    id: seasonResponse.id,
    airDate: seasonResponse.air_date
      ? moment.utc(seasonResponse.air_date).toISOString()
      : undefined,
    name: seasonResponse.name,
    overview: seasonResponse.overview,
    posterPath: seasonResponse.poster_path
      ? seasonResponse.poster_path
      : undefined,
    seasonNumber: seasonResponse.season_number,
    // @ts-expect-error external api
    voteAverage: seasonResponse["vote_average"] as number,
    cast: [...cast],
    crew: [...crew],
    externalIds: [...externalIds],
    images: [...images],
    videos: [...videos],
  };

  return season;
};
