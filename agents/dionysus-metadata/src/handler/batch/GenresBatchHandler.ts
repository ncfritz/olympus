import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  GenreType,
  MetadataFetchJobStatus,
  PartialGenre,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import { Moment } from "moment/moment";
import { GenreEndpoint, Genres } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { type BatchJobMessage } from "../../types/message";
import {
  BATCH_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseBatchHandler } from "./BaseBatchHandler";

@Injectable()
export class GenresBatchHandler extends BaseBatchHandler {
  private records: PartialGenre[] = [];
  private position = 0;

  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.genres.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.genres`,
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
    const endpoint = new GenreEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const tvGenresResponse = await endpoint.tvShows();
    this.processGenresResponse(tvGenresResponse, "TV");

    const movieGenresResponse = await endpoint.movies();
    this.processGenresResponse(movieGenresResponse, "Movie");
  }

  private processGenresResponse(response: Genres, type: GenreType) {
    for (const genre of response.genres) {
      this.records.push({
        id: genre.id,
        name: genre.name,
        type: type,
      });
    }
  }

  private async createGenre(
    line: PartialGenre,
  ): Promise<MetadataFetchJobStatus> {
    try {
      await metadataApi.createGenre(line);
      return "fetched";
    } catch (e) {
      return "failed";
    }
  }

  protected getJobId(json: any): string {
    return `${json.id}-${json.type}`;
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
    return await this.createGenre(line);
  }

  protected async preUpdateMetadataFetchJob(
    id: string,
    type: string,
    currentStatus: MetadataFetchJobStatus,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createGenre(line);
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
