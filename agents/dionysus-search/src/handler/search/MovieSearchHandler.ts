import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  PasswordType,
  BaseSearchResultTag,
  SearchResultTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import axios from "axios";
import moment from "moment/moment";
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
export class MovieSearchHandler extends BaseSearchHandler {
  @RabbitSubscribe({
    exchange: SEARCH_EXECUTION_TRIGGER_EXCHANGE,
    queue: `${SEARCH_EXECUTION_PREFIX}.movie.${TRIGGER_SUFFIX}`,
    routingKey: `${MEDIA_TYPE_PREFIX}.movie`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SearchExecutionMessage, amqMsg: ConsumeMessage) {
    await this.execute("movie", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    const nzbGeekApiKey = this.configService.get("NZBGEEK_API_KEY");
    const result: SearchResult = {
      status: "success",
      newResults: 0,
      skippedRecords: 0,
      duplicateResults: 0,
      totalRecords: 0,
    };

    logger.info(`Fetching movie definition: ${msg.mediaId}`);
    const movieDefinition = (await metadataApi.describeMovie(msg.mediaId)).data
      .movie;

    logger.info("Locating IMDB ID for movie");
    const filteredIds = movieDefinition.externalIds.filter((item) => {
      return item.type === "imdb";
    });

    if (filteredIds.length <= 0) {
      logger.warn("No IMDB ID found, marking search as skipped");
      result.status = "skipped";
      return result;
    }

    const imdbId = filteredIds[0];
    logger.info(`Found IMDB ID ${imdbId.externalId}`);

    const searchId = imdbId.externalId.toLowerCase().startsWith("tt")
      ? imdbId.externalId.substring(2)
      : imdbId.externalId;
    logger.debug(`Search ID: ${searchId}`);

    const offset = 0;

    const nzbGeekUrl = `https://api.nzbgeek.info/api?t=movie&imdbid=${searchId}&limit=200&offset=${offset}&extended=1&o=json&apikey=${nzbGeekApiKey}`;
    const response = await axios.get(nzbGeekUrl);

    if (response.status !== 200) {
      result.status = "failed";
      return result;
    }

    const feed = response.data;
    const channel = feed.channel;

    if (!channel.item) {
      logger.info(`No results found for media ID ${msg.mediaId}... skipping`);
      result.status = "skipped";
      return result;
    }

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
          "movie",
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

      await mediaApi.createMediaAssetSearchResult("movie", msg.mediaId, {
        id: guid,
        assetType: "movie",
        status: "none",
        score: score,
        mediaId: msg.mediaId,
        title: item.title,
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
