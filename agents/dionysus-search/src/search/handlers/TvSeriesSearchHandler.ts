import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { publishMessage } from "@ncfritz/olympus-messages";
import type {
  PartialMediaAssetSearchConfiguration,
  TvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment from "moment";
import { MediaApi } from "../../api/MediaApi";
import { MetadataApi } from "../../api/MetadataApi";
import { NotificationApi } from "../../api/NotificationApi";
import {
  SEARCH_SUBSCRIPTIONS,
  type SearchExecutionMessage,
  searchExecutionRoute,
} from "../../messaging";
import {
  SearchHandler,
  searchResult,
  type SearchResult,
} from "./SearchHandler";

/**
 * Fans a TV series search out to its seasons (not specials): creates
 * missing season search configurations and publishes a search for each due
 * season.
 */
@Injectable()
export class TvSeriesSearchHandler extends SearchHandler {
  constructor(
    mediaApi: MediaApi,
    notificationApi: NotificationApi,
    private readonly metadataApi: MetadataApi,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super(mediaApi, notificationApi);
  }

  @RabbitSubscribe(SEARCH_SUBSCRIPTIONS.tv_series)
  public async handle(msg: SearchExecutionMessage): Promise<void> {
    await this.execute("tv_series", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    this.logger.log(`Executing search for TV Series - ID: ${msg.mediaId}`);

    const result = searchResult("running");

    const seriesSearchConfiguration =
      await this.mediaApi.describeMediaAssetSearchConfiguration(
        "tv_series",
        msg.mediaId,
      );
    if (!seriesSearchConfiguration) {
      throw new Error(`No search configuration for tv_series:${msg.mediaId}`);
    }

    if (!seriesSearchConfiguration.enabled) {
      this.logger.log(
        "Search configuration for series is not enabled... skipping",
      );

      result.status = "skipped";
      return result;
    }

    const tvSeries = await this.metadataApi.describeTvSeries(msg.mediaId);
    result.totalRecords = tvSeries.seasons.length;

    this.logger.log(`Found TV Series with ${tvSeries.numberOfSeasons} seasons`);

    for (const season of tvSeries.seasons) {
      // Season 0 represents specials, which we generally don't care about
      if (season.seasonNumber === 0) {
        result.skippedRecords++;
        continue;
      }

      const seasonSearchConfiguration =
        await this.mediaApi.describeMediaAssetSearchConfiguration(
          "tv_season",
          season.id,
        );

      if (!seasonSearchConfiguration) {
        this.logger.log(
          `No search configuration for season ${season.seasonNumber} - series ID: ${season.id} found, creating...`,
        );

        // There is no need to enqueue an AMQP message at this time as the create operation will
        // take care of this
        await this.mediaApi.createMediaAssetSearchConfiguration({
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
        this.logger.log(
          `Found existing search configuration for season ${season.seasonNumber} - ID: ${season.id}`,
        );

        if (!seasonSearchConfiguration.enabled) {
          this.logger.log(
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
          this.logger.log("Scheduling season search for execution...");

          await publishMessage(
            this.amqpConnection,
            searchExecutionRoute(seasonSearchConfiguration.type),
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
          this.logger.log(
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
      await this.mediaApi.updateMediaAssetSearchConfiguration(
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
