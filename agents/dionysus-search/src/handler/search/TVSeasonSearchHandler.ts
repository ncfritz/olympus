import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  PartialMediaAssetSearchConfiguration,
  Season,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import moment from "moment/moment";
import mediaApi from "../../api/mediaApi";
import metadataApi from "../../api/metadataApi";
import { type SearchExecutionMessage } from "../../types/message";
import {
  MEDIA_TYPE_PREFIX,
  SEARCH_EXECUTION_PREFIX,
  SEARCH_EXECUTION_TRIGGER_EXCHANGE,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { BaseSearchHandler, SearchResult } from "./BaseSearchHandler";

@Injectable()
export class TVSeasonSearchHandler extends BaseSearchHandler {
  @RabbitSubscribe({
    exchange: SEARCH_EXECUTION_TRIGGER_EXCHANGE,
    queue: `${SEARCH_EXECUTION_PREFIX}.tv_season.${TRIGGER_SUFFIX}`,
    routingKey: `${MEDIA_TYPE_PREFIX}.tv_season`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SearchExecutionMessage, amqMsg: ConsumeMessage) {
    await this.execute("tv_season", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    logger.info(msg);

    const result: SearchResult = {
      status: "running",
      newResults: 0,
      duplicateResults: 0,
      skippedRecords: 0,
      totalRecords: 0,
    };

    const seasonSearchConfiguration = (
      await mediaApi.describeMediaAssetSearchConfiguration(
        "tv_season",
        msg.mediaId,
      )
    ).data.searchConfiguration;

    if (!seasonSearchConfiguration.enabled) {
      logger.info("Search configuration for series is not enabled... skipping");

      result.status = "skipped";
      return result;
    }

    const tvSeason = (
      await metadataApi.describeTvSeason(
        seasonSearchConfiguration.seriesId!,
        seasonSearchConfiguration.seasonNumber!,
      )
    ).data.season;
    result.totalRecords = tvSeason.episodes.length;

    logger.info(
      `Found TV Season - ID: ${tvSeason.id} / season ${tvSeason.seasonNumber} for series ID: ${tvSeason.series.id}`,
    );

    for (const episode of tvSeason.episodes) {
      const episodeSearchConfiguration = (
        await mediaApi.describeMediaAssetSearchConfiguration(
          "tv_episode",
          episode.id,
        )
      ).data.searchConfiguration;

      if (!episodeSearchConfiguration) {
        logger.info(
          `No search configuration for episode ${episode.episodeNumber}/season ${episode.seasonNumber} - series ID: ${tvSeason.series.id} found, creating...`,
        );

        await mediaApi.createMediaAssetSearchConfiguration({
          type: "tv_episode",
          mediaId: episode.id,
          backoff: 24,
          jitter: 300,
          enabled: true,
          status: "ok",
          seriesId: tvSeason.series.id,
          seasonNumber: tvSeason.seasonNumber,
          episodeNumber: episode.episodeNumber,
        });

        result.newResults++;
      } else {
        logger.info(
          `Found existing search configuration for episode ${episode.seasonNumber} - ID: ${episode.id}`,
        );

        if (!episodeSearchConfiguration.enabled) {
          logger.info(
            "Search configuration for episode is not enabled... skipping",
          );
          result.skippedRecords++;

          continue;
        }

        const now = moment.utc();
        const nextExecutionTime = moment(
          episodeSearchConfiguration.nextExecutionTime,
        );

        if (now > nextExecutionTime || msg.propagateImmediately) {
          logger.info("Scheduling episode search for execution...");

          await this.amqpConnection.publish(
            "search.execution.trigger",
            `jobType.${episodeSearchConfiguration.type}`,
            {
              mediaId: episodeSearchConfiguration.mediaId,
              propagateImmediately: msg.propagateImmediately,
              initiatingAsset: {
                ...msg.initiatingAsset,
                episode: episode.episodeNumber,
              },
            },
            {
              persistent: true,
            },
          );
        }

        result.duplicateResults++;
      }
    }

    const [backoff, jitter] = this.calculateBackoffAndJitter(tvSeason);
    const updates: PartialMediaAssetSearchConfiguration = {
      backoff: backoff,
      jitter: jitter,
    };

    // If this is a triggered search, we will wait until all children complete before setting the status
    if (msg.initiatingAsset && msg.initiatingAsset.assetType !== "tv_season") {
      updates.status = "ok";
    }

    await mediaApi.updateMediaAssetSearchConfiguration(
      "tv_season",
      msg.mediaId,
      updates,
    );

    result.status = "success";
    return result;
  }

  private calculateBackoffAndJitter(season: Season): [number, number] {
    let backoff = 24;
    let jitter = 300;

    if (
      season.series.status === "Cancelled" ||
      season.series.status === "Ended" ||
      season.series.status === "Planned"
    ) {
      backoff = 7 * 24;
      jitter = 60 * 24 * 2;
    } else if (
      season.series.status === "In Production" ||
      season.series.status === "Returning Series"
    ) {
      if (season.seasonNumber !== season.series.numberOfSeasons) {
        backoff = 7 * 24;
        jitter = 60 * 24 * 2;
      }

      if (season.series.lastAirDate) {
        const lastAirDate = moment(season.series.lastAirDate);
        const lastAirAge = Math.abs(moment.utc().diff(lastAirDate, "days"));

        if (lastAirAge > 30) {
          backoff = 7 * 24;
        } else if (lastAirAge > 14) {
          backoff = 3 * 24;
        }
      }
    }

    return [backoff, jitter];
  }
}
