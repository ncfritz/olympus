import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  PartialEpisode,
  PartialExternalId,
  PartialTvEpisodeCastMember,
  PartialTvEpisodeCrewMember,
  PartialTypedImage,
  PartialVideo,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import moment from "moment/moment";
import { TvEpisodesEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { UniqueSet } from "../../util/UniqueSet";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class TVEpisodeMetadataHandler extends BaseMetadataHandler<
  PartialEpisode,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.tv_episodes.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.tv_episodes`,
    queueOptions: {
      channel: "tvEpisodesChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: MetadataJobMessage, amqpMsg: ConsumeMessage) {
    await this.doFetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    metadataFetchJob: MetadataFetchJob,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataManager: MetadataFetchJobManager,
  ): Promise<[PartialEpisode, undefined]> {
    const endpoint = new TvEpisodesEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const [seriesId, seasonNumber, episodeNumber] = entityId
      .split("-", 3)
      .map((id) => parseInt(id));

    const episodeResponse = await endpoint.details(
      {
        tvShowID: seriesId,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      },
      ["external_ids", "images", "credits", "videos"],
    );

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
      if (episodeResponse.external_ids.imdb_id) {
        externalIds.add({
          type: "imdb",
          externalId: `${episodeResponse.external_ids.imdb_id}`,
        });
      }

      if (episodeResponse.external_ids["wikidata_id"]) {
        externalIds.add({
          type: "wikidata",
          externalId: `${episodeResponse.external_ids["wikidata_id"]}`,
        });
      }

      if (episodeResponse.external_ids.facebook_id) {
        externalIds.add({
          type: "facebook",
          externalId: `${episodeResponse.external_ids.facebook_id}`,
        });
      }

      if (episodeResponse.external_ids.instagram_id) {
        externalIds.add({
          type: "instagram",
          externalId: `${episodeResponse.external_ids.instagram_id}`,
        });
      }

      if (episodeResponse.external_ids.twitter_id) {
        externalIds.add({
          type: "twitter",
          externalId: `${episodeResponse.external_ids.twitter_id}`,
        });
      }
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

    await metadataApi.createTVEpisode(seriesId, seasonNumber, episode);

    return [episode, undefined];
  }

  protected getTtl(metadata: PartialEpisode): number {
    if (metadata.airDate) {
      const now = moment.utc();
      // Positive values indicate the episode has aired in the past, negative values indicate the episode is yet
      // to air
      const delta = now.diff(metadata.airDate, "days");

      if (delta <= 0) {
        return 3;
      } else if (delta < 7) {
        return 7;
      } else if (delta < 30) {
        return 14;
      }
    }

    return Math.max(30, Math.floor(Math.random() * 60));
  }

  protected getJitter(metadata: PartialEpisode): number {
    if (metadata.airDate) {
      const now = moment.utc();
      const delta = now.diff(metadata.airDate, "days");

      if (delta <= 0) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      } else if (delta < 7) {
        return Math.floor(Math.random() * 3 * 24 * 60);
      } else if (delta < 30) {
        return Math.floor(Math.random() * 7 * 24 * 60);
      }
    }

    return Math.floor(Math.random() * 60 * 24 * 60);
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }
}
