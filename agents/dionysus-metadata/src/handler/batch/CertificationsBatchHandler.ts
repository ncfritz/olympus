import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  CertificationType,
  JobType,
  MetadataFetchJobStatus,
  PartialCertification,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import { Moment } from "moment/moment";
import { Certifications } from "tmdb-ts";
import { CertificationEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { BatchJobMessage } from "../../types/message";
import {
  BATCH_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseBatchHandler } from "./BaseBatchHandler";

@Injectable()
export class CertificationsBatchHandler extends BaseBatchHandler {
  private records: PartialCertification[] = [];
  private position = 0;

  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.${JobType.CERTIFICATIONS}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.CERTIFICATIONS}`,
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
    const endpoint = new CertificationEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const tvCertificationsResponse = await endpoint.tvShows();

    this.processCertificationsResponse(
      tvCertificationsResponse,
      CertificationType.TV,
    );

    const movieCertificationsResponse = await endpoint.movies();

    this.processCertificationsResponse(
      movieCertificationsResponse,
      CertificationType.MOVIE,
    );
  }

  private processCertificationsResponse(
    response: Certifications,
    type: CertificationType,
  ) {
    for (const country in response.certifications) {
      // @ts-expect-error external api
      for (const certification of response.certifications[country]) {
        this.records.push({
          country: country,
          type: type,
          certification: certification.certification,
          order: certification.order,
          meaning: certification.meaning,
        });
      }
    }
  }

  private async createCertification(
    line: PartialCertification,
  ): Promise<MetadataFetchJobStatus> {
    try {
      await metadataApi.createCertification(line);
      return MetadataFetchJobStatus.FETCHED;
    } catch (e) {
      return MetadataFetchJobStatus.FAILED;
    }
  }

  protected getJobId(json: any): string {
    return `${json.country}_${json.type}_${json.certification}`;
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
    return await this.createCertification(line);
  }

  protected async preUpdateMetadataFetchJob(
    id: string,
    type: string,
    currentStatus: MetadataFetchJobStatus,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createCertification(line);
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
