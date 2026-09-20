import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MediaAssetSearchConfiguration,
  PartialMediaAssetSearchConfiguration,
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
} from "../../messaging";
import { NzbGeekClient } from "../services/NzbGeekClient";
import {
  SearchHandler,
  searchResult,
  type SearchResult,
} from "./SearchHandler";

/**
 * Searches the indexer for a TV episode's releases by the series' TVDB ID
 * and `SxxEyy`, now or (for a propagated search) at its next execution.
 */
@Injectable()
export class TvEpisodeSearchHandler extends SearchHandler {
  constructor(
    mediaApi: MediaSearchApi,
    notificationApi: NotificationApi,
    private readonly metadataApi: MetadataApi,
    private readonly nzbGeek: NzbGeekClient,
  ) {
    super(mediaApi, notificationApi);
  }

  @RabbitSubscribe(SEARCH_SUBSCRIPTIONS.tv_episode)
  public async handle(msg: SearchExecutionMessage): Promise<void> {
    await this.execute("tv_episode", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    this.logger.log(`Episode search: ${JSON.stringify(msg)}`);

    let result = searchResult("success");

    const searchConfiguration =
      await this.mediaApi.describeMediaAssetSearchConfiguration(
        "tv_episode",
        msg.mediaId,
      );
    if (!searchConfiguration) {
      throw new Error(`No search configuration for tv_episode:${msg.mediaId}`);
    }

    const now = moment.utc();
    const nextExecutionTime = moment(searchConfiguration.nextExecutionTime);

    this.logger.debug(`Now: ${now.toISOString()}`);
    this.logger.debug(
      `Next execution time: ${nextExecutionTime.toISOString()}`,
    );

    const updates: PartialMediaAssetSearchConfiguration = {
      status: "ok",
    };

    // If the message is set for immediate propagation and there isn't an associated originating asset, run the search.
    // If and the next execution time is in the future, update it to now so it gets run during the next search
    // trigger.  If the message is not set for immediate propagation, the search was triggered on a scheduled run, so
    // run it immediately.
    if (msg.propagateImmediately && !msg.initiatingAsset) {
      this.logger.log(
        "Initiating asset not present and message is set for immediate propagation, executing search",
      );
      result = await this.runSearch(msg, searchConfiguration);
    } else if (
      msg.propagateImmediately &&
      msg.initiatingAsset &&
      msg.initiatingAsset.assetType === "tv_episode"
    ) {
      this.logger.log(
        "Initiating asset present and assetType is tv_episode, executing search",
      );
      result = await this.runSearch(msg, searchConfiguration);
    } else if (msg.propagateImmediately && nextExecutionTime > now) {
      this.logger.log(
        "Initiating asset present and next execution time is in future, updating next execution to now()",
      );
      updates.nextExecutionTime = now.toISOString();
    } else {
      this.logger.log("Executing immediately");
      result = await this.runSearch(msg, searchConfiguration);
    }

    await this.mediaApi.updateMediaAssetSearchConfiguration(
      "tv_episode",
      msg.mediaId,
      updates,
    );

    return result;
  }

  private async runSearch(
    msg: SearchExecutionMessage,
    searchConfiguration: MediaAssetSearchConfiguration,
  ): Promise<SearchResult> {
    const result = searchResult("success");
    const { seriesId, seasonNumber, episodeNumber } = searchConfiguration;

    if (!seriesId || !seasonNumber || !episodeNumber) {
      this.logger.error(
        "Required TV episode identifier (seriesId, seasonNumber, episodeNumber) not present in msg",
      );

      result.status = "failed";
      return result;
    }

    this.logger.log(`Fetching TV episode definition: ${msg.mediaId}`);
    const episode = await this.metadataApi.describeTvEpisode(
      seriesId,
      seasonNumber,
      episodeNumber,
    );
    const series = await this.metadataApi.describeTvSeries(seriesId);

    const tvdbId = series.externalIds.find((item) => item.type === "tvdb");

    if (!tvdbId) {
      this.logger.warn("No TVDB ID found, marking search as skipped");
      result.status = "skipped";
      return result;
    }

    this.logger.log(`Found TVDB ID ${tvdbId.externalId}`);

    const query = `S${String(episode.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;

    const response = await this.nzbGeek.searchTvEpisode(
      tvdbId.externalId,
      query,
    );

    if (response.status !== 200) {
      result.status = "failed";
      return result;
    }

    const items = response.data.channel.item;

    if (!items) {
      this.logger.log(
        `No results found for media ID ${msg.mediaId}... skipping`,
      );
      result.status = "skipped";
      return result;
    }

    await this.recordResults("tv_episode", msg.mediaId, items, result);
    return result;
  }
}
