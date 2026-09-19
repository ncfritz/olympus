import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { ExportBatchHandler } from "./ExportBatchHandler";

/** TV series (their seasons and episodes are queued by the series fetches). */
@Injectable()
export class TvSeriesBatchHandler extends ExportBatchHandler {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.tv_series)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected getExportPrefix(): string {
    return "tv_series";
  }
}
