import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { FilterDefinition } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import moment from "moment";
import mediaApi from "../../api/mediaApi";
import { type SearchFanoutMessage } from "../../types/message";
import {
  SEARCH_FANOUT_PREFIX,
  SEARCH_FANOUT_TRIGGER_EXCHANGE,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";

@Injectable()
export class SearchConfigurationFanoutHandler {
  constructor(private readonly amqpConnection: AmqpConnection) {
    this.amqpConnection = amqpConnection;
  }

  @RabbitSubscribe({
    exchange: SEARCH_FANOUT_TRIGGER_EXCHANGE,
    queue: `${SEARCH_FANOUT_PREFIX}.${TRIGGER_SUFFIX}`,
    routingKey: "", // This is a fanout exchange, so we don't need a routing key'
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SearchFanoutMessage, amqMsg: ConsumeMessage) {
    try {
      const now = moment.utc();
      const filter: FilterDefinition = {
        name: "_and",
        type: "and",
        value: [
          {
            name: "enabled",
            type: "eq",
            value: true,
          },
          {
            name: "nextExecutionTime",
            type: "lte",
            value: now.toISOString(),
          },
        ],
      };

      const configurationsToTriggerResult =
        await mediaApi.listMediaAssetSearchConfigurations(
          0,
          msg.maxEntriesToProcess,
          { field: "nextExecutionTime", order: "asc" },
          filter,
        );
      const configurationsToTrigger =
        configurationsToTriggerResult.data.searchConfigurations;

      if (configurationsToTrigger.length === 0) {
        logger.info("No search configurations to trigger");
        return;
      } else {
        for (const configuration of configurationsToTrigger) {
          const msg: any = {
            mediaId: configuration.mediaId,
            propagateImmediately: true,
            initiatingAsset: {
              assetType: configuration.type,
              mediaId: configuration.mediaId,
            },
          };

          if (configuration.type === "tv_season") {
            msg.initiatingAsset = {
              assetType: configuration.type,
              mediaId: configuration.mediaId,
              seriesId: configuration.seriesId,
              seasonNumber: configuration.seasonNumber,
            };
          } else if (configuration.type === "tv_episode") {
            msg.initiatingAsset = {
              assetType: configuration.type,
              mediaId: configuration.mediaId,
              seriesId: configuration.seriesId,
              seasonNumber: configuration.seasonNumber,
              episodeNumber: configuration.episodeNumber,
            };
          }

          logger.info(
            `Publishing message for ${configuration.type}:${configuration.mediaId}`,
          );

          await this.amqpConnection.publish(
            "search.execution.trigger",
            `jobType.${configuration.type}`,
            msg,
            {
              persistent: true,
              headers: {
                "x-delay":
                  Math.floor(Math.random() * (60000 - 1000 + 1)) + 1000,
              },
            },
          );
        }
      }
    } catch (e) {
      logger.error("Unable to process search fanout message: ");
      logger.error(e);
    }
  }
}
