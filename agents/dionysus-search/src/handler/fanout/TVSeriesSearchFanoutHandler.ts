import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { type SearchFanoutMessage } from "../../types/message";
import {
  MEDIA_TYPE_PREFIX,
  SEARCH_FANOUT_PREFIX,
  SEARCH_FANOUT_TRIGGER_EXCHANGE,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";

@Injectable()
export class TVSeriesSearchFanoutHandler {
  @RabbitSubscribe({
    exchange: SEARCH_FANOUT_TRIGGER_EXCHANGE,
    queue: `${SEARCH_FANOUT_PREFIX}.tv_series.${TRIGGER_SUFFIX}`,
    routingKey: `${MEDIA_TYPE_PREFIX}.tv_series`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: SearchFanoutMessage, amqMsg: ConsumeMessage) {
    logger.info(msg);
  }
}
