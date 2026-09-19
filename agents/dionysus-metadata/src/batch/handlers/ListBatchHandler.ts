import type { MetadataFetchJobStatus } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { ListSource } from "../sources/ListSource";
import { BatchHandler } from "./BatchHandler";

/**
 * A batch job over one of TMDB's small reference lists (certifications,
 * countries, genres, languages): stores each entry right away instead of
 * queueing a fetch, and refreshes them every 90 days.
 */
@Injectable()
export abstract class ListBatchHandler<R> extends BatchHandler<R> {
  /** The list, from TMDB. */
  protected abstract loadRecords(): Promise<R[]>;

  /** Stores an entry through the API. */
  protected abstract storeRecord(record: R): Promise<unknown>;

  protected createSource(): ListSource<R> {
    return new ListSource(() => this.loadRecords());
  }

  protected getTtl(): number {
    return 90;
  }

  protected shouldPublishNotifications(): boolean {
    return false;
  }

  protected async preCreateMetadataFetchJob(
    _id: string,
    _type: string,
    record: R,
  ): Promise<MetadataFetchJobStatus> {
    return await this.store(record);
  }

  protected async preUpdateMetadataFetchJob(
    _id: string,
    _type: string,
    _currentStatus: MetadataFetchJobStatus,
    record: R,
  ): Promise<MetadataFetchJobStatus> {
    return await this.store(record);
  }

  private async store(record: R): Promise<MetadataFetchJobStatus> {
    try {
      await this.storeRecord(record);
      return "fetched";
    } catch {
      return "failed";
    }
  }
}
