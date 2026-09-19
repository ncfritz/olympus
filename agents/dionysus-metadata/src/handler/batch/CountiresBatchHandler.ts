import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJobStatus,
  PartialCountry,
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
export class CountriesBatchHandler extends BaseBatchHandler {
  private records: PartialCountry[] = [];
  private position = 0;

  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.countries.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.countries`,
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
    const countriesResponse = await this.tmdbApi.listCountries();

    for (const country of countriesResponse) {
      this.records.push({
        id: country.iso_3166_1,
        name: country.english_name,
      });
    }
  }

  private async createCountry(
    line: PartialCountry,
  ): Promise<MetadataFetchJobStatus> {
    try {
      await metadataApi.createCountry(line);
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
    return await this.createCountry(line);
  }

  protected async preUpdateMetadataFetchJob(
    id: string,
    type: string,
    currentStatus: MetadataFetchJobStatus,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createCountry(line);
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
