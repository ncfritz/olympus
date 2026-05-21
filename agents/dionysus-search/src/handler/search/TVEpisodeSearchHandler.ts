import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  MediaAssetSearchConfiguration,
  PartialMediaAssetSearchConfiguration,
  BaseSearchResultTag,
  PasswordType,
  SearchResultTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import axios from "axios";
import moment from "moment";
import mediaApi from "../../api/mediaApi";
import metadataApi from "../../api/metadataApi";
import { parseTitle } from "../../metadata/detector";
import { evaluate } from "../../metadata/tag/tagEvaluator";
import { TAGS } from "../../metadata/tag/tags";
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
export class TVEpisodeSearchHandler extends BaseSearchHandler {
  @RabbitSubscribe({
    exchange: SEARCH_EXECUTION_TRIGGER_EXCHANGE,
    queue: `${SEARCH_EXECUTION_PREFIX}.tv_episode.${TRIGGER_SUFFIX}`,
    routingKey: `${MEDIA_TYPE_PREFIX}.tv_episode`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SearchExecutionMessage, amqMsg: ConsumeMessage) {
    await this.execute("tv_episode", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    logger.info(JSON.stringify(msg, null, 2));

    let result: SearchResult = {
      status: "success",
      newResults: 0,
      skippedRecords: 0,
      duplicateResults: 0,
      totalRecords: 0,
    };

    const searchConfiguration = (
      await mediaApi.describeMediaAssetSearchConfiguration(
        "tv_episode",
        msg.mediaId,
      )
    ).data.searchConfiguration;
    const now = moment.utc();
    const nextExecutionTime = moment(searchConfiguration.nextExecutionTime);

    logger.debug(`Now: ${now.toISOString()}`);
    logger.debug(`Next execution time: ${nextExecutionTime.toISOString()}`);

    const updates: PartialMediaAssetSearchConfiguration = {
      status: "ok",
    };

    // If the message is set for immediate propagation and there isn't an associated originating asset, run the search.
    // If and the next execution time is in the future, update it to now so it gets run during the next search
    // trigger.  If the message is not set for immediate propagation, the search was triggered on a scheduled run, so
    // run it immediately.
    if (msg.propagateImmediately && !msg.initiatingAsset) {
      logger.info(
        "Initiating asset not present and message is set for immediate propagation, executing search",
      );
      result = await this.runSearch(msg, searchConfiguration);
    } else if (
      msg.propagateImmediately &&
      msg.initiatingAsset &&
      msg.initiatingAsset.assetType === "tv_episode"
    ) {
      logger.info(
        "Initiating asset present and assetType is tv_episode, executing search",
      );
      result = await this.runSearch(msg, searchConfiguration);
    } else if (msg.propagateImmediately && nextExecutionTime > now) {
      logger.info(
        "Initiating asset present and next execution time is in future, updating next execution to now()",
      );
      updates.nextExecutionTime = now.toISOString();
    } else {
      logger.info("Executing immediately");
      result = await this.runSearch(msg, searchConfiguration);
    }

    logger.info("Updating search configuration...");
    await mediaApi.updateMediaAssetSearchConfiguration(
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
    const nzbGeekApiKey = this.configService.get("NZBGEEK_API_KEY");
    const result: SearchResult = {
      status: "success",
      newResults: 0,
      skippedRecords: 0,
      duplicateResults: 0,
      totalRecords: 0,
    };

    if (
      !searchConfiguration.seriesId ||
      !searchConfiguration.seasonNumber ||
      !searchConfiguration.episodeNumber
    ) {
      logger.error(
        "Required TV episode identifier (seriesId, seasonNumber, episodeNumber) not present in msg",
      );

      result.status = "failed";
      return result;
    }

    logger.info(`Fetching TV episode definition: ${msg.mediaId}`);
    const tvEpisodeDefinition = (
      await metadataApi.describeTvEpisode(
        searchConfiguration.seriesId,
        searchConfiguration.seasonNumber,
        searchConfiguration.episodeNumber,
      )
    ).data.episode;
    const tvSeriesDefinition = (
      await metadataApi.describeTvSeries(searchConfiguration.seriesId)
    ).data.tvSeries;

    logger.info("Locating TVBD ID for TV series");
    const filteredIds = tvSeriesDefinition.externalIds.filter((item) => {
      return item.type === "tvdb";
    });

    if (filteredIds.length <= 0) {
      logger.warn("No TVDB ID found, marking search as skipped");
      result.status = "skipped";
      return result;
    }

    const tvdbId = filteredIds[0];
    logger.info(`Found TVDB ID ${tvdbId.externalId}`);

    const searchId = tvdbId.externalId;
    const query = `S${String(tvEpisodeDefinition.seasonNumber).padStart(2, "0")}E${String(tvEpisodeDefinition.episodeNumber).padStart(2, "0")}`;
    logger.debug(`Search ID: ${searchId}`);

    const offset = 0;

    const nzbGeekUrl = `https://api.nzbgeek.info/api?t=tvsearch&q=${query}&tvdbid=${searchId}&limit=200&offset=${offset}&extended=1&o=json&apikey=${nzbGeekApiKey}`;
    const response = await axios.get(nzbGeekUrl);

    if (response.status !== 200) {
      result.status = "failed";
      return result;
    }

    const feed = response.data;
    const channel = feed.channel;

    for (const item of channel.item) {
      const guid = this.findAttribute("guid", item.attr);
      const size = this.findAttribute("size", item.attr);
      const password = this.findAttribute("password", item.attr);
      const usenetDate = this.findAttribute("usenetdate", item.attr);

      if (!guid || !size || !password || !usenetDate) {
        result.skippedRecords++;
        continue;
      }

      const existingSearchResult = (
        await mediaApi.describeMediaAssetSearchResult(
          "tv_episode",
          msg.mediaId,
          guid,
        )
      ).data.searchResult;

      if (existingSearchResult) {
        result.duplicateResults++;
        continue;
      }

      const titleInfo = parseTitle(item.title);

      const tags: BaseSearchResultTag[] = [];
      let score = 0;

      Object.entries(TAGS).forEach(([category, definitions]) => {
        definitions.forEach((definition) => {
          const result = evaluate(titleInfo, definition);
          logger.debug(result);

          if (result) {
            tags.push({
              type: category as SearchResultTagType,
              value: result.name,
              score: result.value,
            });
            score += result.value;
          }
        });
      });

      const parsedUsenetDate = moment.utc(usenetDate);

      await mediaApi.createMediaAssetSearchResult("tv_episode", msg.mediaId, {
        id: guid,
        assetType: "tv_episode",
        mediaId: msg.mediaId,
        title: item.title,
        status: "none",
        score: score,
        size: parseInt(size),
        password: parseInt(password) as PasswordType,
        quality: titleInfo.quality.name,
        qualityGroup: titleInfo.quality.group,
        source: titleInfo.quality.source,
        resolution: titleInfo.quality.resolution,
        modifier: titleInfo.quality.modifier,
        repack: titleInfo.revision.repack,
        postedTime: parsedUsenetDate.toISOString(),
        tags: tags,
      });

      result.newResults++;
    }

    return result;
  }
}
