import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type { PartialLanguage } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { ListBatchHandler } from "./ListBatchHandler";

/** Languages (ISO 639-1). */
@Injectable()
export class LanguagesBatchHandler extends ListBatchHandler<PartialLanguage> {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.languages)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected async loadRecords(): Promise<PartialLanguage[]> {
    const languagesResponse = await this.tmdbClient.listLanguages();

    return languagesResponse.map((language) => ({
      id: language.iso_639_1,
      name: language.english_name,
      nativeName: language.name,
    }));
  }

  protected storeRecord(record: PartialLanguage) {
    return this.metadataApi.createLanguage(record);
  }
}
