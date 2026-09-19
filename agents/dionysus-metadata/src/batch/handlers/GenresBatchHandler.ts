import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { PartialGenre } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { toGenres } from "../mappers/referenceLists";
import { ListBatchHandler } from "./ListBatchHandler";

/** Movie and TV genres. */
@Injectable()
export class GenresBatchHandler extends ListBatchHandler<PartialGenre> {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.genres)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected async loadRecords(): Promise<PartialGenre[]> {
    const records: PartialGenre[] = [];
    const tvGenresResponse = await this.tmdbClient.getTvShowGenres();
    records.push(...toGenres(tvGenresResponse, "TV"));

    const movieGenresResponse = await this.tmdbClient.getMovieGenres();
    records.push(...toGenres(movieGenresResponse, "Movie"));

    return records;
  }

  protected storeRecord(record: PartialGenre) {
    return this.metadataApi.createGenre(record);
  }

  protected getJobId(record: PartialGenre): string {
    return `${record.id}-${record.type}`;
  }
}
