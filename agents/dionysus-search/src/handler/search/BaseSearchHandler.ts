import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MediaAssetSearchType,
  SearchExecutionStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import moment from "moment";
import mediaApi from "../../api/mediaApi";
import notificationsApi from "../../api/notificationsApi";
import type { SearchExecutionMessage } from "../../types/message";
import { logger } from "../../util/logger";

export type SearchResult = {
  status: SearchExecutionStatus;
  newResults: number;
  duplicateResults: number;
  skippedRecords: number;
  totalRecords: number;
};

@Injectable()
export abstract class BaseSearchHandler {
  constructor(
    protected readonly amqpConnection: AmqpConnection,
    protected readonly configService: ConfigService,
  ) {
    this.amqpConnection = amqpConnection;
    this.configService = configService;
  }

  protected abstract doSearch(
    msg: SearchExecutionMessage,
  ): Promise<SearchResult>;

  protected async execute(
    assetType: MediaAssetSearchType,
    msg: SearchExecutionMessage,
  ) {
    try {
      const searchExecution = (
        await mediaApi.createMediaAssetSearchExecution(assetType, msg.mediaId)
      ).data.searchExecution;

      let result: SearchResult = {
        status: "skipped",
        newResults: 0,
        duplicateResults: 0,
        skippedRecords: 0,
        totalRecords: 0,
      };

      try {
        result = await this.doSearch(msg);
      } catch (e) {
        console.log(e);
        result.status = "failed";
      } finally {
        await mediaApi.updateMediaAssetSearchExecution(
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
          let count: number | undefined = undefined;

          if (msg.initiatingAsset.assetType === "tv_series") {
            count = (
              await mediaApi.getMediaAssetSearchConfigurationsRunningCount(
                msg.initiatingAsset.assetType,
                msg.initiatingAsset.mediaId,
              )
            ).data.count;
          } else if (msg.initiatingAsset.assetType === "tv_season") {
            count = (
              await mediaApi.getMediaAssetSearchConfigurationsRunningCount(
                msg.initiatingAsset.assetType,
                msg.initiatingAsset.seriesId,
                msg.initiatingAsset.seasonNumber,
              )
            ).data.count;
            console.log(count);
          }

          if (
            count === 0 ||
            msg.initiatingAsset.assetType === "movie" ||
            msg.initiatingAsset.assetType === "tv_episode"
          ) {
            await mediaApi.updateMediaAssetSearchConfiguration(
              msg.initiatingAsset.assetType,
              msg.initiatingAsset.mediaId,
              { status: "ok" },
            );

            logger.info("Publishing search completion message");

            await notificationsApi.sendNotification({
              type: "dionysus_media_asset_search_refresh_complete",
              webSocketDestination: {
                closable: true,
                level: "success",
              },
              context: {
                assetType: msg.initiatingAsset.assetType,
                mediaId: msg.initiatingAsset.mediaId,
              },
            });
          }
        }
      }
    } catch (e) {
      console.log(e);
      logger.error("Unable to process search message: ", e);
    }
  }

  protected findAttribute(name: string, attrs: any[]): string | undefined {
    for (const item of attrs) {
      if (item["@attributes"].name === name) {
        return item["@attributes"].value;
      }
    }

    return undefined;
  }
}
