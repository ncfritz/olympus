import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import {
  ASSETS_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../util/constants";

@Injectable()
export class DeleteAssetHandler {
  @RabbitSubscribe({
    exchange: `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${ASSETS_JOB_PREFIX}.delete.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.delete`,
  })
  public async handle(msg: {}, amqlMsg: ConsumeMessage) {
    console.log(msg);
  }
}
