import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { PartialCertification } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { toCertifications } from "../mappers/referenceLists";
import { ListBatchHandler } from "./ListBatchHandler";

/** Movie and TV certifications (ratings), by country. */
@Injectable()
export class CertificationsBatchHandler extends ListBatchHandler<PartialCertification> {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.certifications)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected async loadRecords(): Promise<PartialCertification[]> {
    const records: PartialCertification[] = [];
    const tvCertificationsResponse =
      await this.tmdbClient.getTvCertifications();
    records.push(...toCertifications(tvCertificationsResponse, "TV"));

    const movieCertificationsResponse =
      await this.tmdbClient.getMovieCertifications();
    records.push(...toCertifications(movieCertificationsResponse, "Movie"));

    return records;
  }

  protected storeRecord(record: PartialCertification) {
    return this.metadataApi.createCertification(record);
  }

  protected getJobId(record: PartialCertification): string {
    return `${record.country}_${record.type}_${record.certification}`;
  }
}
