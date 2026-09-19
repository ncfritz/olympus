import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  MetadataFetchJobStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { REDRIVE_SUBSCRIPTION, type RedriveJobMessage } from "../../messaging";
import { RedriveSource } from "../sources/RedriveSource";
import { BatchHandler } from "./BatchHandler";

/**
 * Redrive: sets the fetch jobs of a type in a status (default failed) to a
 * target status, bypassing the cache and the freshness check, and queues
 * them again if asked to (`republish`).
 */
@Injectable()
export class RedriveBatchHandler extends BatchHandler<
  MetadataFetchJob,
  RedriveJobMessage
> {
  @RabbitSubscribe(REDRIVE_SUBSCRIPTION)
  public async handle(message: RedriveJobMessage): Promise<void> {
    await this.run(message);
  }

  protected createSource(message: RedriveJobMessage): RedriveSource {
    return new RedriveSource(
      this.metadataApi,
      message.jobType,
      message.status || "failed",
    );
  }

  protected shouldPublishNotifications(message: RedriveJobMessage): boolean {
    return message.republish || false;
  }

  protected shouldBypassCacheOnPublish(): boolean {
    return true;
  }

  protected shouldIgnoreStaleCheck(): boolean {
    return true;
  }

  protected shouldUseReadCache(): boolean {
    return false;
  }

  protected shouldUseWriteCache(): boolean {
    return false;
  }

  protected async preCreateMetadataFetchJob(
    _id: string,
    _type: string,
    _record: MetadataFetchJob,
    message: RedriveJobMessage,
  ): Promise<MetadataFetchJobStatus> {
    return message.targetStatus;
  }

  protected async preUpdateMetadataFetchJob(
    _id: string,
    _type: string,
    _currentStatus: MetadataFetchJobStatus,
    _record: MetadataFetchJob,
    message: RedriveJobMessage,
  ): Promise<MetadataFetchJobStatus> {
    return message.targetStatus;
  }
}
