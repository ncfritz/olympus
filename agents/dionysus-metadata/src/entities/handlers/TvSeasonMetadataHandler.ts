import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialSeason,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment, { type Moment } from "moment";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toTvSeason } from "../mappers/tvSeason";
import { EntityHandler } from "./EntityHandler";

/** What the season's refresh policy needs. */
export type TvSeasonContext = {
  lastEpisodeAirDate: Moment;
};

/** A TV season (entity id `<series>-<season>`); queues a fetch of each episode that is new or due. */
@Injectable()
export class TvSeasonMetadataHandler extends EntityHandler<
  PartialSeason,
  TvSeasonContext
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.tv_seasons)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    metadataFetchJob: MetadataFetchJob,
    metadataManager: FetchJobStore,
  ): Promise<[PartialSeason, TvSeasonContext]> {
    const [seriesId, seasonNumber] = entityId
      .split("-", 2)
      .map((id) => parseInt(id));

    const seasonResponse = await this.tmdbClient.getTvSeasonDetails(
      { tvShowID: seriesId, seasonNumber: seasonNumber },
      ["external_ids", "images", "aggregate_credits", "videos"],
    );

    const season = toTvSeason(seasonResponse);

    await this.metadataApi.createTVSeason(seriesId, season);

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
          this.logger.debug(
            `Episode ${episodeKey} is fresh... expiration time ${expirationTime.toISOString()}...skipping`,
          );
          continue;
        } else {
          this.logger.log(`Episode ${episodeKey} is expired... re-processing`);
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

  protected getTtl(metadata: PartialSeason, context: TvSeasonContext): number {
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
    context: TvSeasonContext,
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
}
