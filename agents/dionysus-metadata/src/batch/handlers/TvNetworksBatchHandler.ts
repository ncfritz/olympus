import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { BATCH_SUBSCRIPTIONS, type BatchJobMessage } from "../../messaging";
import { ExportBatchHandler } from "./ExportBatchHandler";

/** TV networks. */
@Injectable()
export class TvNetworksBatchHandler extends ExportBatchHandler {
  @RabbitSubscribe(BATCH_SUBSCRIPTIONS.tv_networks)
  public async handle(message: BatchJobMessage): Promise<void> {
    await this.run(message);
  }

  protected getExportPrefix(): string {
    return "tv_network";
  }
}
