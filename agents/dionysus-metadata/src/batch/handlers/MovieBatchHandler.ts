import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { ExportBatchHandler } from "./ExportBatchHandler";

/** Movies (the largest export). */
@Injectable()
export class MovieBatchHandler extends ExportBatchHandler {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.movies)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected getExportPrefix(): string {
    return "movie";
  }
}
