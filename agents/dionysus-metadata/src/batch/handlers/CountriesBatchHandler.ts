import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { PartialCountry } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { ListBatchHandler } from "./ListBatchHandler";

/** Countries (ISO 3166-1). */
@Injectable()
export class CountriesBatchHandler extends ListBatchHandler<PartialCountry> {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.countries)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected async loadRecords(): Promise<PartialCountry[]> {
    const countriesResponse = await this.tmdbClient.listCountries();

    return countriesResponse.map((country) => ({
      id: country.iso_3166_1,
      name: country.english_name,
    }));
  }

  protected storeRecord(record: PartialCountry) {
    return this.metadataApi.createCountry(record);
  }
}
