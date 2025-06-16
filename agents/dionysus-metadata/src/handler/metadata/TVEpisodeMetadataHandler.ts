import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJob,
  PartialEpisode,
  PartialTVEpisodeCastMember,
  PartialTVEpisodeCrewMember,
  PartialTVEpisodeImage,
  PartialTVEpisodeVideo,
  PartialTVSeriesExternalId,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import moment from "moment/moment";
import { TvEpisodesEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataJobMessage } from "../../types/message";
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
    queue: `${METADATA_JOB_PREFIX}.${JobType.TV_EPISODES}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.TV_EPISODES}`,
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

    const episode = new PartialEpisode();
    episode.id = episodeResponse.id;
    // @ts-expect-error this is a known key in this instance
    episode.seasonId = parseInt(metadataFetchJob.context["seasonId"]);
    episode.airDate = moment(episodeResponse.air_date);
    episode.name = episodeResponse.name;
    episode.overview = episodeResponse.overview;
    episode.stillPath = episodeResponse.still_path
      ? episodeResponse.still_path
      : undefined;
    episode.seasonNumber = episodeResponse.season_number;
    episode.productionCode = episodeResponse.production_code;
    episode.episodeNumber = episodeResponse.episode_number;

    const cast: UniqueSet<PartialTVEpisodeCastMember> = new UniqueSet();

    episodeResponse.credits.cast.forEach((value) => {
      cast.add({
        personId: value.id,
        character: value.character,
        creditId: value.credit_id,
        order: value.order,
        originalName: value.original_name,
      });
    });

    const crew: UniqueSet<PartialTVEpisodeCrewMember> = new UniqueSet();

    episodeResponse.credits.crew.forEach((value) => {
      crew.add({
        personId: value.id,
        creditId: value.credit_id,
        job: value.job,
        department: value.department,
        originalName: value.original_name,
      });
    });

    const externalIds: UniqueSet<PartialTVSeriesExternalId> = new UniqueSet();

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

    const guestStars: UniqueSet<PartialTVEpisodeCastMember> = new UniqueSet();

    episodeResponse.credits.guest_stars.forEach((value) => {
      guestStars.add({
        personId: value.id,
        character: value.character,
        creditId: value.credit_id,
        order: value.order,
        originalName: value.original_name,
      });
    });

    const images: UniqueSet<PartialTVEpisodeImage> = new UniqueSet();

    // @ts-expect-error API incorrectly modelled
    episodeResponse.images["stills"].forEach((value) => {
      images.add({
        type: "still",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    const videos: UniqueSet<PartialTVEpisodeVideo> = new UniqueSet();

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

    episode.cast = [...cast];
    episode.crew = [...crew];
    episode.externalIds = [...externalIds];
    episode.guestStars = [...guestStars];
    episode.images = [...images];
    episode.videos = [...videos];

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
