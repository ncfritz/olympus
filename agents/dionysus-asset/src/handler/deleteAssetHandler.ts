import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import type { DeleteAssetMessage } from "../types/messages";
import {
  ASSETS_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../util/constants";
import { logger } from "../util/logger";

@Injectable()
export class DeleteAssetHandler {
  @RabbitSubscribe({
    exchange: `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${ASSETS_JOB_PREFIX}.delete.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.delete`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: DeleteAssetMessage, amqMsg: ConsumeMessage) {
    logger.info(msg);
  }
}
