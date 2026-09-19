import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { delayed, publishMessage } from "@ncfritz/olympus-messages";
import type { FilterDefinition } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable, Logger } from "@nestjs/common";
import moment from "moment";
import { MediaApi } from "../../api/MediaApi";
import {
  FANOUT_SUBSCRIPTION,
  type InitiatingAsset,
  type SearchExecutionMessage,
  searchExecutionRoute,
  type SearchFanoutMessage,
} from "../../messaging";

/** Spreads the triggered searches over a minute: 1 to 60 seconds. */
const randomDelay = () => Math.floor(Math.random() * (60000 - 1000 + 1)) + 1000;

/**
 * Triggers the enabled search configurations that are due, soonest first,
 * up to maxEntriesToProcess: publishes a search for each, delayed randomly
 * so they don't all hit the indexer at once.
 */
@Injectable()
export class SearchConfigurationFanoutHandler {
  private readonly logger = new Logger(SearchConfigurationFanoutHandler.name);

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly mediaApi: MediaApi,
  ) {}

  @RabbitSubscribe(FANOUT_SUBSCRIPTION)
  public async handle(msg: SearchFanoutMessage): Promise<void> {
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

      const configurationsToTrigger =
        await this.mediaApi.listMediaAssetSearchConfigurations(
          0,
          msg.maxEntriesToProcess,
          { field: "nextExecutionTime", order: "asc" },
          filter,
        );

      if (configurationsToTrigger.length === 0) {
        this.logger.log("No search configurations to trigger");
        return;
      }

      this.logger.log(
        `Found ${configurationsToTrigger.length} search configurations to trigger`,
      );

      for (const configuration of configurationsToTrigger) {
        let initiatingAsset: InitiatingAsset = {
          assetType: configuration.type,
          mediaId: configuration.mediaId,
        };

        if (configuration.type === "tv_season") {
          initiatingAsset = {
            ...initiatingAsset,
            seriesId: configuration.seriesId,
            seasonNumber: configuration.seasonNumber,
          };
        } else if (configuration.type === "tv_episode") {
          initiatingAsset = {
            ...initiatingAsset,
            seriesId: configuration.seriesId,
            seasonNumber: configuration.seasonNumber,
            episodeNumber: configuration.episodeNumber,
          };
        }

        const search: SearchExecutionMessage = {
          mediaId: configuration.mediaId,
          propagateImmediately: true,
          initiatingAsset,
        };

        this.logger.log(
          `Publishing message for ${configuration.type}:${configuration.mediaId}`,
        );

        await publishMessage(
          this.amqpConnection,
          searchExecutionRoute(configuration.type),
          search,
          delayed(randomDelay()),
        );
      }
    } catch (e) {
      this.logger.error(
        "Unable to process search fanout message",
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
