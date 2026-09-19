import type {
  MetadataFetchJob,
  PartialEpisode,
  PartialExternalId,
  PartialTvEpisodeCastMember,
  PartialTvEpisodeCrewMember,
  PartialTypedImage,
  PartialVideo,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import { TV_EPISODE_ID_TYPES } from "./externalIds";
import { UniqueSet } from "./UniqueSet";
import type { TmdbClient } from "../../tmdb/services/TmdbClient";

/** Maps TMDB's responses for a TV episode to the API entity. */
export const toTvEpisode = (
  episodeResponse: Awaited<ReturnType<TmdbClient["getTvEpisodeDetails"]>>,
  metadataFetchJob: MetadataFetchJob,
): PartialEpisode => {
  const cast: UniqueSet<PartialTvEpisodeCastMember> = new UniqueSet();

  episodeResponse.credits.cast.forEach((value) => {
    cast.add({
      personId: value.id,
      character: value.character,
      creditId: value.credit_id,
      order: value.order,
      originalName: value.original_name,
    });
  });

  const crew: UniqueSet<PartialTvEpisodeCrewMember> = new UniqueSet();

  episodeResponse.credits.crew.forEach((value) => {
    crew.add({
      personId: value.id,
      creditId: value.credit_id,
      job: value.job,
      department: value.department,
      originalName: value.original_name,
    });
  });

  const externalIds: UniqueSet<PartialExternalId> = new UniqueSet();

  if (episodeResponse.external_ids) {
    Object.entries(TV_EPISODE_ID_TYPES).forEach(([idType, idName]) => {
      if (episodeResponse.external_ids[idType as never]) {
        externalIds.add({
          type: idName,
          externalId: `${episodeResponse.external_ids[idType as never]}`,
        });
      }
    });
  }

  const guestStars: UniqueSet<PartialTvEpisodeCastMember> = new UniqueSet();

  episodeResponse.credits.guest_stars.forEach((value) => {
    guestStars.add({
      personId: value.id,
      character: value.character,
      creditId: value.credit_id,
      order: value.order,
      originalName: value.original_name,
    });
  });

  const images: UniqueSet<PartialTypedImage> = new UniqueSet();

  // @ts-expect-error API incorrectly modelled
  episodeResponse.images["stills"].forEach((value) => {
    images.add({
      type: "still",
      filePath: value.file_path,
      width: value.width,
      height: value.height,
      languageCode: value.iso_639_1 || "en",
    });
  });

  const videos: UniqueSet<PartialVideo> = new UniqueSet();

  episodeResponse.videos.results.forEach((value) => {
    videos.add({
      type: value.type,
      countryCode: value.iso_3166_1,
      languageCode: value.iso_639_1,
      id: value.id,
      name: value.name,
      // @ts-expect-error external api
      official: value.official,
      key: value.key,
      site: value.site,
      size: value.size,
      // @ts-expect-error external api
      official: value["official"] as boolean,
      // @ts-expect-error external api
      publishedDate: moment(value["published_at"]),
    });
  });

  const episode: PartialEpisode = {
    id: episodeResponse.id,
    // @ts-expect-error this is a known key in this instance
    seasonId: parseInt(metadataFetchJob.context["seasonId"]),
    airDate: episodeResponse.air_date
      ? moment(episodeResponse.air_date).toISOString()
      : undefined,
    name: episodeResponse.name,
    overview: episodeResponse.overview,
    stillPath: episodeResponse.still_path
      ? episodeResponse.still_path
      : undefined,
    runtime: episodeResponse.runtime,
    seasonNumber: episodeResponse.season_number,
    productionCode: episodeResponse.production_code,
    episodeNumber: episodeResponse.episode_number,
    voteCount: episodeResponse.vote_count,
    voteAverage: episodeResponse.vote_average,
    cast: [...cast],
    crew: [...crew],
    externalIds: [...externalIds],
    guestStars: [...guestStars],
    images: [...images],
    videos: [...videos],
  };

  return episode;
};
