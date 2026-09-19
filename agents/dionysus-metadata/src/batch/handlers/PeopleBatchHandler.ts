import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { ExportBatchHandler } from "./ExportBatchHandler";

/** People. */
@Injectable()
export class PeopleBatchHandler extends ExportBatchHandler {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.people)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected getExportPrefix(): string {
    return "person";
  }
}
