import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJob,
  MetadataFetchJobStatus,
  PartialSeason,
  PartialTVSeriesCastMember,
  PartialTVSeriesCrewMember,
  PartialTVSeriesExternalId,
  PartialTVSeriesImage,
  PartialTVSeriesVideo,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import moment from "moment/moment";
import { AggregateCast, AggregateCrew } from "tmdb-ts";
import { TvSeasonsEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataJobMessage, TVSeasonContext } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { UniqueSet } from "../../util/UniqueSet";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class TVSeasonMetadataHandler extends BaseMetadataHandler<
  PartialSeason,
  TVSeasonContext
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.${JobType.TV_SEASONS}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.TV_SEASONS}`,
    queueOptions: {
      channel: "tvSeasonsChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: MetadataJobMessage, amqpMsg: ConsumeMessage) {
    await this.doFetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataFetchJob: MetadataFetchJob,
  ): Promise<[PartialSeason, TVSeasonContext]> {
    const endpoint = new TvSeasonsEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const [seriesId, seasonNumber] = entityId
      .split("-", 2)
      .map((id) => parseInt(id));

    const seasonResponse = await endpoint.details(
      { tvShowID: seriesId, seasonNumber: seasonNumber },
      ["external_ids", "images", "aggregate_credits", "videos"],
    );

    const season = new PartialSeason();
    season.id = seasonResponse.id;
    season.airDate = moment(seasonResponse.air_date);
    season.name = seasonResponse.name;
    season.overview = seasonResponse.overview;
    season.posterPath = seasonResponse.poster_path
      ? seasonResponse.poster_path
      : undefined;
    season.seasonNumber = seasonResponse.season_number;

    const cast: UniqueSet<PartialTVSeriesCastMember> = new UniqueSet();

    // @ts-expect-error - expected per API - TS bindings are incorrect
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

    const crew: UniqueSet<PartialTVSeriesCrewMember> = new UniqueSet();

    // @ts-expect-error - expected per API - TS bindings are incorrect
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

    const externalIds: UniqueSet<PartialTVSeriesExternalId> = new UniqueSet();

    if (seasonResponse.external_ids) {
      if (seasonResponse.external_ids.imdb_id) {
        externalIds.add({
          type: "imdb",
          externalId: `${seasonResponse.external_ids.imdb_id}`,
        });
      }

      if (seasonResponse.external_ids["wikidata_id"]) {
        externalIds.add({
          type: "wikidata",
          externalId: `${seasonResponse.external_ids["wikidata_id"]}`,
        });
      }

      if (seasonResponse.external_ids.facebook_id) {
        externalIds.add({
          type: "facebook",
          externalId: `${seasonResponse.external_ids.facebook_id}`,
        });
      }

      if (seasonResponse.external_ids.instagram_id) {
        externalIds.add({
          type: "instagram",
          externalId: `${seasonResponse.external_ids.instagram_id}`,
        });
      }

      if (seasonResponse.external_ids.twitter_id) {
        externalIds.add({
          type: "twitter",
          externalId: `${seasonResponse.external_ids.twitter_id}`,
        });
      }
    }

    const images: UniqueSet<PartialTVSeriesImage> = new UniqueSet();

    seasonResponse.images.posters.forEach((value) => {
      images.add({
        type: "poster",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    const videos: UniqueSet<PartialTVSeriesVideo> = new UniqueSet();

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
        publishedDate: moment(value["published_at"]),
      });
    });

    season.cast = [...cast];
    season.crew = [...crew];
    season.externalIds = [...externalIds];
    season.images = [...images];
    season.videos = [...videos];

    await metadataApi.createTVSeason(seriesId, season);

    let lastEpisodeAirDate = undefined;

    for (const episode of seasonResponse.episodes) {
      const ttl = 7;
      const jitter = Math.floor(Math.random() * 3 * 24 * 60);

      if (!lastEpisodeAirDate || episode.air_date > lastEpisodeAirDate) {
        lastEpisodeAirDate = episode.air_date;
      }

      await metadataApi.createMetadataFetchJob(
        `${seriesId}-${seasonNumber}-${episode.episode_number}`,
        JobType.TV_EPISODES,
        ttl,
        jitter,
        MetadataFetchJobStatus.QUEUED,
        true,
        { seasonId: season.id },
      );
    }

    return [season, { lastEpisodeAirDate: moment(lastEpisodeAirDate) }];
  }

  protected getTtl(metadata: PartialSeason, context: TVSeasonContext): number {
    if (context.lastEpisodeAirDate) {
      const now = moment.utc();
      // Positive values indicate the episode has aired in the past, negative values indicate the episode is yet
      // to air
      const delta = now.diff(context.lastEpisodeAirDate, "days");

      if (delta <= 0) {
        return 3;
      } else if (delta < 7) {
        return 5;
      } else if (delta < 30) {
        return Math.max(14, Math.floor(Math.random() * 30));
      }
    }

    return Math.max(30, Math.floor(Math.random() * 60));
  }

  protected getJitter(
    metadata: PartialSeason,
    context: TVSeasonContext,
  ): number {
    if (context.lastEpisodeAirDate) {
      const now = moment.utc();
      const delta = now.diff(context.lastEpisodeAirDate, "days");

      if (delta <= 0) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      } else if (delta < 7) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      } else if (delta < 30) {
        return Math.floor(Math.random() * 14 * 24 * 60);
      }
    }

    return Math.floor(Math.random() * 60 * 24 * 60);
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }
}
