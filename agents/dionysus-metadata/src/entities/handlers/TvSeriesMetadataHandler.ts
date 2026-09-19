import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialTvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment from "moment";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toTvSeries } from "../mappers/tvSeries";
import { EntityHandler } from "./EntityHandler";

/** A TV series; queues a fetch of each season that is new or due. */
@Injectable()
export class TvSeriesMetadataHandler extends EntityHandler<
  PartialTvSeries,
  undefined
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.tv_series)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    metadataFetchJob: MetadataFetchJob,
    metadataManager: FetchJobStore,
  ): Promise<[PartialTvSeries, undefined]> {
    const seriesId = parseInt(entityId);

    const seriesResponse = await this.tmdbClient.getTvSeriesDetails(seriesId, [
      "alternative_titles",
      "content_ratings",
      "external_ids",
      "images",
      "keywords",
      "aggregate_credits",
      "videos",
    ]);

    const recommendationsResponse =
      await this.tmdbClient.getTvSeriesRecommendation(seriesId, {
        language: "en-US",
        page: 1,
      });

    const series = toTvSeries(seriesResponse, recommendationsResponse);

    await this.metadataApi.createTVSeries(series);

    for (const season of seriesResponse.seasons) {
      const seasonKey = `${seriesResponse.id}-${season.season_number}`;
      const seasonFetchJob = await metadataManager.getMetadataFetchJob(
        seasonKey,
        "tv_seasons",
        false,
      );

      if (seasonFetchJob) {
        const now = moment.utc();
        const expirationTime = moment(seasonFetchJob.lastFetchedTime)
          .add(metadataFetchJob.ttl, "days")
          .add(metadataFetchJob.jitter, "minutes");

        if (expirationTime.isAfter(now)) {
          this.logger.debug(
            `Season ${seasonKey} is fresh... expiration time ${expirationTime.toISOString()}...skipping`,
          );
          continue;
        } else {
          this.logger.log(`Season ${seasonKey} is expired... re-processing`);
        }
      }

      const ttl = 7;
      const jitter = Math.floor(Math.random() * 3 * 24 * 60);

      await metadataManager.createMetadataFetchJob(
        seasonKey,
        "tv_seasons",
        ttl,
        jitter,
        "queued",
        true,
        { seasons: seriesResponse.seasons.length },
      );
    }

    return [series, undefined];
  }

  protected getTtl(metadata: PartialTvSeries): number {
    if (metadata.lastAirDate) {
      const now = moment.utc();
      // Positive values indicate the episode has aired in the past, negative values indicate the episode is yet
      // to air
      const delta = now.diff(metadata.lastAirDate, "days");

      // If the episode has not aired, check every day, otherwise if it has recently aired (within a month)
      // check every three days.
      if (delta <= 0) {
        return 1;
      } else if (delta < 30) {
        return 3;
      }
    }

    // If there hasn't been a recent;y aired episode but the series is still in production check weekly.
    if (metadata.inProduction) {
      return 7;
    }

    return Math.max(60, Math.floor(Math.random() * 75));
  }

  protected getJitter(metadata: PartialTvSeries): number {
    if (metadata.lastAirDate) {
      const now = moment.utc();
      const delta = now.diff(metadata.lastAirDate, "days");

      if (delta <= 0) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      } else if (delta < 30) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      }
    }

    // If there hasn't been a recent;y aired episode but the series is still in production check weekly.
    if (metadata.inProduction) {
      return Math.floor(Math.random() * 2 * 24 * 60);
    }

    return Math.floor(Math.random() * 60 * 24 * 60);
  }
}
