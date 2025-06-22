import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJobStatus,
  PartialLanguage,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import { Moment } from "moment/moment";
import metadataApi from "../../api/metadataApi";
import { ConfigurationEndpoint } from "../../api/tmdb/configuration";
import { BatchJobMessage } from "../../types/message";
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
    queue: `${BATCH_JOB_PREFIX}.${JobType.LANGUAGES}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.LANGUAGES}`,
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
    const endpoint = new ConfigurationEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const languagesResponse = await endpoint.languages();

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
      return MetadataFetchJobStatus.FETCHED;
    } catch (e) {
      return MetadataFetchJobStatus.FAILED;
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
