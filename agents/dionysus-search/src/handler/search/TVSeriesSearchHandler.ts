import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  PartialMediaAssetSearchConfiguration,
  TvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import moment from "moment";
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
export class TVSeriesSearchHandler extends BaseSearchHandler {
  @RabbitSubscribe({
    exchange: SEARCH_EXECUTION_TRIGGER_EXCHANGE,
    queue: `${SEARCH_EXECUTION_PREFIX}.tv_series.${TRIGGER_SUFFIX}`,
    routingKey: `${MEDIA_TYPE_PREFIX}.tv_series`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SearchExecutionMessage, amqMsg: ConsumeMessage) {
    await this.execute("tv_series", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    logger.info(`Executing search for TV Series - ID: ${msg.mediaId}`);

    const result: SearchResult = {
      status: "running",
      newResults: 0,
      duplicateResults: 0,
      skippedRecords: 0,
      totalRecords: 0,
    };

    const seriesSearchConfiguration = (
      await mediaApi.describeMediaAssetSearchConfiguration(
        "tv_series",
        msg.mediaId,
      )
    ).data.searchConfiguration;

    if (!seriesSearchConfiguration.enabled) {
      logger.info("Search configuration for series is not enabled... skipping");

      result.status = "skipped";
      return result;
    }

    const tvSeries = (await metadataApi.describeTvSeries(msg.mediaId)).data
      .tvSeries;
    result.totalRecords = tvSeries.seasons.length;

    logger.info(`Found TV Series with ${tvSeries.numberOfSeasons} seasons`);

    for (const season of tvSeries.seasons) {
      // Season 0 represents specials, which we generally don't care about
      if (season.seasonNumber === 0) {
        result.skippedRecords++;
        continue;
      }

      const seasonSearchConfiguration = (
        await mediaApi.describeMediaAssetSearchConfiguration(
          "tv_season",
          season.id,
        )
      ).data.searchConfiguration;

      if (!seasonSearchConfiguration) {
        logger.info(
          `No search configuration for season ${season.seasonNumber} - series ID: ${season.id} found, creating...`,
        );

        // There is no need to enqueue an AMQP message at this time as the create operation will
        // take care of this
        await mediaApi.createMediaAssetSearchConfiguration({
          type: "tv_season",
          mediaId: season.id,
          backoff: 24,
          jitter: 300,
          enabled: true,
          status: "ok",
          seriesId: msg.mediaId,
          seasonNumber: season.seasonNumber,
        });

        result.newResults++;
      } else {
        logger.info(
          `Found existing search configuration for season ${season.seasonNumber} - ID: ${season.id}`,
        );

        if (!seasonSearchConfiguration.enabled) {
          logger.info(
            "Search configuration for season is not enabled... skipping",
          );
          result.skippedRecords++;

          continue;
        }

        const now = moment.utc();
        const nextExecutionTime = moment(
          seasonSearchConfiguration.nextExecutionTime,
        );

        if (now > nextExecutionTime || msg.propagateImmediately) {
          logger.info("Scheduling season search for execution...");

          await this.amqpConnection.publish(
            "search.execution.trigger",
            `jobType.${seasonSearchConfiguration.type}`,
            {
              mediaId: seasonSearchConfiguration.mediaId,
              propagateImmediately: msg.propagateImmediately,
              initiatingAsset: msg.initiatingAsset,
            },
            {
              persistent: true,
            },
          );

          result.duplicateResults++;
        } else {
          logger.info(
            `Next execution time - ${nextExecutionTime.toISOString()} - is in the future, skipping season search`,
          );

          result.skippedRecords++;
        }
      }

      const [backoff, jitter] = this.calculateBackoffAndJitter(tvSeries);
      const updates: PartialMediaAssetSearchConfiguration = {
        backoff: backoff,
        jitter: jitter,
      };

      // If this is a triggered search, we will wait until all children complete before setting the status
      if (!msg.initiatingAsset) {
        updates.status = "ok";
      }
      await mediaApi.updateMediaAssetSearchConfiguration(
        "tv_series",
        msg.mediaId,
        updates,
      );
    }

    result.status = "success";
    return result;
  }

  private calculateBackoffAndJitter(tvSeries: TvSeries): [number, number] {
    let backoff = 24;
    let jitter = 300;

    if (
      tvSeries.status === "Cancelled" ||
      tvSeries.status === "Ended" ||
      tvSeries.status === "Planned"
    ) {
      backoff = 7 * 24;
      jitter = 60 * 24 * 2;
    } else if (
      tvSeries.status === "In Production" ||
      tvSeries.status === "Returning Series"
    ) {
      if (tvSeries.lastAirDate) {
        const lastAirDate = moment(tvSeries.lastAirDate);
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
