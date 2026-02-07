import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  PartialExternalId,
  PartialSeason,
  PartialTvSeriesCastMember,
  PartialTvSeriesCrewMember,
  PartialTypedImage,
  PartialVideo,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import moment from "moment/moment";
import { AggregateCast, AggregateCrew } from "tmdb-ts";
import { TvSeasonsEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage, TVSeasonContext } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
  TV_SEASON_ID_TYPES,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { UniqueSet } from "../../util/UniqueSet";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class TVSeasonMetadataHandler extends BaseMetadataHandler<
  PartialSeason,
  TVSeasonContext
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.tv_seasons.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.tv_seasons`,
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
    metadataFetchJob: MetadataFetchJob,
    metadataManager: MetadataFetchJobManager,
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

    const cast: UniqueSet<PartialTvSeriesCastMember> = new UniqueSet();

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

    const crew: UniqueSet<PartialTvSeriesCrewMember> = new UniqueSet();

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
        publishedDate: moment(value["published_at"]),
      });
    });

    const season: PartialSeason = {
      id: seasonResponse.id,
      airDate: seasonResponse.air_date
        ? moment(seasonResponse.air_date).toISOString()
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

    await metadataApi.createTVSeason(seriesId, season);

    let lastEpisodeAirDate = undefined;

    for (const episode of seasonResponse.episodes) {
      if (!lastEpisodeAirDate || episode.air_date > lastEpisodeAirDate) {
        lastEpisodeAirDate = episode.air_date;
      }

      const episodeKey = `${seriesId}-${seasonNumber}-${episode.episode_number}`;
      const episodeFetchJob = await metadataManager.getMetadataFetchJob(
        episodeKey,
        "tv_episodes",
        false,
      );

      if (episodeFetchJob) {
        const now = moment.utc();
        const expirationTime = moment(episodeFetchJob.lastFetchedTime)
          .add(metadataFetchJob.ttl, "days")
          .add(metadataFetchJob.jitter, "minutes");

        if (expirationTime.isAfter(now)) {
          logger.debug(
            `Episode ${episodeKey} is fresh... expiration time ${expirationTime.toISOString()}...skipping`,
          );
          continue;
        } else {
          logger.info(`Episode ${episodeKey} is expired... re-processing`);
        }
      }

      const ttl = 7;
      const jitter = Math.floor(Math.random() * 3 * 24 * 60);

      await metadataManager.createMetadataFetchJob(
        episodeKey,
        "tv_episodes",
        ttl,
        jitter,
        "queued",
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
