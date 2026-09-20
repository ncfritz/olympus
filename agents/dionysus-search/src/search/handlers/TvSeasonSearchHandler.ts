import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { publishMessage } from "@ncfritz/olympus-messages";
import type {
  PartialMediaAssetSearchConfiguration,
  Season,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment from "moment";
import {
  MediaSearchApi,
  MetadataApi,
  NotificationApi,
} from "@ncfritz/olympus-client";
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
 * Fans a TV season search out to its episodes: creates missing episode
 * search configurations and publishes a search for each due episode.
 */
@Injectable()
export class TvSeasonSearchHandler extends SearchHandler {
  constructor(
    mediaApi: MediaSearchApi,
    notificationApi: NotificationApi,
    private readonly metadataApi: MetadataApi,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super(mediaApi, notificationApi);
  }

  @RabbitSubscribe(SEARCH_SUBSCRIPTIONS.tv_season)
  public async handle(msg: SearchExecutionMessage): Promise<void> {
    await this.execute("tv_season", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    this.logger.log(`Season search: ${JSON.stringify(msg)}`);

    const result = searchResult("running");

    const seasonSearchConfiguration =
      await this.mediaApi.describeMediaAssetSearchConfiguration(
        "tv_season",
        msg.mediaId,
      );
    if (!seasonSearchConfiguration) {
      throw new Error(`No search configuration for tv_season:${msg.mediaId}`);
    }

    if (!seasonSearchConfiguration.enabled) {
      this.logger.log(
        "Search configuration for series is not enabled... skipping",
      );

      result.status = "skipped";
      return result;
    }

    const tvSeason = await this.metadataApi.describeTvSeason(
      seasonSearchConfiguration.seriesId!,
      seasonSearchConfiguration.seasonNumber!,
    );
    result.totalRecords = tvSeason.episodes.length;

    this.logger.log(
      `Found TV Season - ID: ${tvSeason.id} / season ${tvSeason.seasonNumber} for series ID: ${seasonSearchConfiguration.seriesId}`,
    );

    for (const episode of tvSeason.episodes) {
      const episodeSearchConfiguration =
        await this.mediaApi.describeMediaAssetSearchConfiguration(
          "tv_episode",
          episode.id,
        );

      if (!episodeSearchConfiguration) {
        this.logger.log(
          `No search configuration for episode ${episode.episodeNumber}/season ${episode.seasonNumber} - series ID: ${seasonSearchConfiguration.seriesId} found, creating...`,
        );

        await this.mediaApi.createMediaAssetSearchConfiguration({
          type: "tv_episode",
          mediaId: episode.id,
          backoff: 24,
          jitter: 300,
          enabled: true,
          status: "ok",
          seriesId: seasonSearchConfiguration.seriesId,
          seasonNumber: tvSeason.seasonNumber,
          episodeNumber: episode.episodeNumber,
        });

        result.newResults++;
      } else {
        this.logger.log(
          `Found existing search configuration for episode ${episode.seasonNumber} - ID: ${episode.id}`,
        );

        if (!episodeSearchConfiguration.enabled) {
          this.logger.log(
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
          this.logger.log("Scheduling episode search for execution...");

          await publishMessage(
            this.amqpConnection,
            searchExecutionRoute(episodeSearchConfiguration.type),
            {
              mediaId: episodeSearchConfiguration.mediaId,
              propagateImmediately: msg.propagateImmediately,
              initiatingAsset: msg.initiatingAsset && {
                ...msg.initiatingAsset,
                episodeNumber: episode.episodeNumber,
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

    await this.mediaApi.updateMediaAssetSearchConfiguration(
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

    // The series can be missing (no referential integrity yet); keep the
    // defaults then.
    const series = season.series;
    if (!series) {
      return [backoff, jitter];
    }

    if (
      series.status === "Cancelled" ||
      series.status === "Ended" ||
      series.status === "Planned"
    ) {
      backoff = 7 * 24;
      jitter = 60 * 24 * 2;
    } else if (
      series.status === "In Production" ||
      series.status === "Returning Series"
    ) {
      if (season.seasonNumber !== series.numberOfSeasons) {
        backoff = 7 * 24;
        jitter = 60 * 24 * 2;
      }

      if (series.lastAirDate) {
        const lastAirDate = moment(series.lastAirDate);
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
