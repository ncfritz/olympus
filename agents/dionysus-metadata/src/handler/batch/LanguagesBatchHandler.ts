import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJobStatus,
  PartialLanguage,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import { Moment } from "moment/moment";
import metadataApi from "../../api/metadataApi";
import { type BatchJobMessage } from "../../types/message";
import {
  BATCH_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseBatchHandler } from "./BaseBatchHandler";

@Injectable()
export class LanguagesBatchHandler extends BaseBatchHandler {
  private records: PartialLanguage[] = [];
  private position = 0;

  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.languages.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.languages`,
    queueOptions: {
      channel: "batchJobsChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  public async handle(message: BatchJobMessage, amqpMessage: ConsumeMessage) {
    return await this.doFetch(message, amqpMessage);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async init(now: Moment) {
    const languagesResponse = await this.tmdbApi.listLanguages();

    for (const language of languagesResponse) {
      this.records.push({
        id: language.iso_639_1,
        name: language.english_name,
        nativeName: language.name,
      });
    }
  }

  private async createLanguage(
    line: PartialLanguage,
  ): Promise<MetadataFetchJobStatus> {
    try {
      await metadataApi.createLanguage(line);
      return "fetched";
    } catch (e) {
      return "failed";
    }
  }

  protected getJobId(json: any): string {
    return json.id;
  }

  protected getTtl(): number {
    return 90;
  }

  protected shouldPublishNotifications(): boolean {
    return false;
  }

  protected async preCreateMetadataFetchJob(
    id: string,
    type: string,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createLanguage(line);
  }

  protected async preUpdateMetadataFetchJob(
    id: string,
    type: string,
    currentStatus: MetadataFetchJobStatus,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createLanguage(line);
  }

  protected async cleanup() {
    this.records = [];
    this.position = 0;

    await super.cleanup();
  }

  protected async nextRecord(): Promise<string | undefined> {
    if (this.position === this.records.length) {
      return undefined;
    }

    const record = this.records[this.position];
    this.position++;

    return JSON.stringify(record);
  }

  protected getRecordCount(): number {
    return this.records.length;
  }
}
