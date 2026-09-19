import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { MetadataFetchJobStatus } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import type { ExportLine } from "../sources/ExportFileSource";
import { ExportBatchHandler } from "./ExportBatchHandler";

/** Keywords: the export has everything, so each is stored right away. */
@Injectable()
export class KeywordsBatchHandler extends ExportBatchHandler {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.keywords)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected getExportPrefix(): string {
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
    _id: string,
    _type: string,
    line: ExportLine,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createOrUpdateKeyword(line);
  }

  protected async preUpdateMetadataFetchJob(
    _id: string,
    _type: string,
    _currentStatus: MetadataFetchJobStatus,
    line: ExportLine,
  ): Promise<MetadataFetchJobStatus> {
    return await this.createOrUpdateKeyword(line);
  }

  private async createOrUpdateKeyword(
    line: ExportLine,
  ): Promise<MetadataFetchJobStatus> {
    try {
      await this.metadataApi.createKeyword({
        // The export's numeric id, sent as is (the SDK types it a string).
        id: line.id as unknown as string,
        value: line.name!,
      });
      return "fetched";
    } catch {
      return "failed";
    }
  }
}
