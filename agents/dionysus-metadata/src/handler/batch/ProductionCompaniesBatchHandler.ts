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
export class ProductionCompaniesBatchHandler extends BaseExportBatchHandler {
  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.${JobType.PRODUCTION_COMPANIES}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.PRODUCTION_COMPANIES}`,
    queueOptions: {
      channel: "batchJobsChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  public async handle(message: BatchJobMessage, amqpMessage: ConsumeMessage) {
    return await this.doFetch(message, amqpMessage);
  }

  getExportPrefix(): string {
    return "production_company";
  }
}
