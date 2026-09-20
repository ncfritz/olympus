import type {
  MediaAssetSearchType,
  PasswordType,
  SearchExecutionStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Logger } from "@nestjs/common";
import moment from "moment";
import type { MediaSearchApi, NotificationApi } from "@ncfritz/olympus-client";
import type { SearchExecutionMessage } from "../../messaging";
import { scoreRelease } from "../../releases/scoreRelease";
import { newznabAttribute, type NewznabItem } from "../services/NzbGeekClient";

/** The outcome of a search, recorded on its search execution. */
export type SearchResult = {
  status: SearchExecutionStatus;
  newResults: number;
  duplicateResults: number;
  skippedRecords: number;
  totalRecords: number;
};

export const searchResult = (status: SearchExecutionStatus): SearchResult => ({
  status,
  newResults: 0,
  duplicateResults: 0,
  skippedRecords: 0,
  totalRecords: 0,
});

/**
 * One search of an asset type: records a search execution around doSearch()
 * and, for a search started from a search configuration (initiatingAsset),
 * marks that configuration done and notifies the site once every search it
 * fanned out to has finished.
 */
export abstract class SearchHandler {
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    protected readonly mediaApi: MediaSearchApi,
    private readonly notificationApi: NotificationApi,
  ) {}

  protected abstract doSearch(
    msg: SearchExecutionMessage,
  ): Promise<SearchResult>;

  protected async execute(
    assetType: MediaAssetSearchType,
    msg: SearchExecutionMessage,
  ): Promise<void> {
    const now = moment.utc();

    try {
      const searchExecution =
        await this.mediaApi.createMediaAssetSearchExecution(
          assetType,
          msg.mediaId,
        );

      let result = searchResult("skipped");

      try {
        result = await this.doSearch(msg);
      } catch (e) {
        this.logger.error(
          `Search of ${assetType}:${msg.mediaId} failed`,
          e instanceof Error ? e.stack : String(e),
        );
        result.status = "failed";
      } finally {
        await this.mediaApi.updateMediaAssetSearchExecution(
          assetType,
          msg.mediaId,
          searchExecution.id,
          {
            status: result.status,
            newRecords: result.newResults,
            duplicateRecords: result.duplicateResults,
            skippedRecords: result.skippedRecords,
            totalRecords: result.totalRecords,
            finishedTime: moment.utc().toISOString(),
          },
        );

        if (msg.initiatingAsset) {
          const initiatingAsset = msg.initiatingAsset;
          let count: number | undefined = undefined;

          if (initiatingAsset.assetType === "tv_series") {
            count =
              await this.mediaApi.getMediaAssetSearchConfigurationsRunningCount(
                initiatingAsset.assetType,
                initiatingAsset.mediaId,
              );
          } else if (initiatingAsset.assetType === "tv_season") {
            count =
              await this.mediaApi.getMediaAssetSearchConfigurationsRunningCount(
                initiatingAsset.assetType,
                initiatingAsset.seriesId!,
                initiatingAsset.seasonNumber,
              );
          }

          const searchConfiguration =
            await this.mediaApi.updateMediaAssetSearchConfiguration(
              initiatingAsset.assetType,
              initiatingAsset.mediaId,
              {
                status: "ok",
                lastExecutionTime: now.toISOString(),
              },
            );

          if (
            count === 0 ||
            initiatingAsset.assetType === "movie" ||
            initiatingAsset.assetType === "tv_episode"
          ) {
            this.logger.log("Publishing search completion message");

            await this.notificationApi.sendNotification({
              type: "dionysus_media_asset_search_refresh_complete",
              webSocketDestination: {
                closable: true,
                level: "success",
              },
              context: {
                assetType: initiatingAsset.assetType,
                mediaId: initiatingAsset.mediaId,
                media: searchConfiguration.decoration,
              },
            });
          }
        }
      }
    } catch (e) {
      this.logger.error(
        "Unable to process search message",
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /**
   * Stores the indexer's releases as search results, scored by their
   * tags; skips releases missing an attribute and ones already stored.
   */
  protected async recordResults(
    assetType: MediaAssetSearchType,
    mediaId: number,
    items: NewznabItem[],
    result: SearchResult,
  ): Promise<void> {
    for (const item of items) {
      const guid = newznabAttribute(item, "guid");
      const size = newznabAttribute(item, "size");
      const password = newznabAttribute(item, "password");
      const usenetDate = newznabAttribute(item, "usenetdate");

      if (!guid || !size || !password || !usenetDate) {
        result.skippedRecords++;
        continue;
      }

      const existingSearchResult =
        await this.mediaApi.describeMediaAssetSearchResult(
          assetType,
          mediaId,
          guid,
        );

      if (existingSearchResult) {
        result.duplicateResults++;
        continue;
      }

      const { titleInfo, tags, score } = scoreRelease(item.title);

      await this.mediaApi.createMediaAssetSearchResult(assetType, mediaId, {
        id: guid,
        assetType,
        status: "none",
        score,
        mediaId,
        title: item.title,
        size: parseInt(size),
        password: parseInt(password) as PasswordType,
        quality: titleInfo.quality.name,
        qualityGroup: titleInfo.quality.group,
        source: titleInfo.quality.source,
        resolution: titleInfo.quality.resolution,
        modifier: titleInfo.quality.modifier,
        repack: titleInfo.revision.repack,
        postedTime: moment.utc(usenetDate).toISOString(),
        tags,
      });

      result.newResults++;
    }
  }
}
