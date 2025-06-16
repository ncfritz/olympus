import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import { JobType, MetadataFetchJobStatus } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import metadataApi from "../../api/metadataApi";
import { BatchJobMessage } from "../../types/message";
import {
  BATCH_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseExportBatchHandler } from "./BaseExportBatchHandler";

@Injectable()
export class KeywordsBatchHandler extends BaseExportBatchHandler {
  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.${JobType.KEYWORDS}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.KEYWORDS}`,
    queueOptions: {
      channel: "batchJobsChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  public async handle(message: BatchJobMessage, amqpMessage: ConsumeMessage) {
    return await this.doFetch(message, amqpMessage);
  }

  getExportPrefix(): string {
    return "keyword";
  }

  protected getTtl(): number {
    return Math.max(14, Math.floor(Math.random() * 120));
  }

  protected getJitter(): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }

  protected shouldPublishNotifications(): boolean {
    return false;
  }

  protected async preCreateMetadataFetchJob(
    id: string,
    type: string,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createOrUpdateKeyword(line);
  }

  protected async preUpdateMetadataFetchJob(
    id: string,
    type: string,
    currentStatus: MetadataFetchJobStatus,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createOrUpdateKeyword(line);
  }

  private async createOrUpdateKeyword(
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    try {
      await metadataApi.createKeyword({
        id: line.id,
        value: line.name,
      });
      return MetadataFetchJobStatus.FETCHED;
    } catch (e) {
      return MetadataFetchJobStatus.FAILED;
    }
  }
}
