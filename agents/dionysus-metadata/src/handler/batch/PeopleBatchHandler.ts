import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import { JobType } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import { BatchJobMessage } from "../../types/message";
import {
  BATCH_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseExportBatchHandler } from "./BaseExportBatchHandler";

@Injectable()
export class PeopleBatchHandler extends BaseExportBatchHandler {
  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.${JobType.PEOPLE}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.PEOPLE}`,
    queueOptions: {
      channel: "batchJobsChannel",
      arguments: {
        "x-consumer-timeout": 6 * 60 * 60 * 1000, // 6h in ms
      },
    },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  public async handle(message: BatchJobMessage, amqpMessage: ConsumeMessage) {
    return await this.doFetch(message, amqpMessage);
  }

  getExportPrefix(): string {
    return "person";
  }

  protected shouldAckMessage(): boolean {
    return false;
  }
}
