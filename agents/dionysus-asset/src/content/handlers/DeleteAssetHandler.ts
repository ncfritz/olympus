import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  CONTENT_SUBSCRIPTIONS,
  type ContentAssetJobMessage,
} from "../../messaging";

/** Deleting content assets: not implemented, the message is only logged. */
@Injectable()
export class DeleteAssetHandler {
  private readonly logger = new Logger(DeleteAssetHandler.name);

  @RabbitSubscribe(CONTENT_SUBSCRIPTIONS.delete)
  public async handle(msg: ContentAssetJobMessage): Promise<void> {
    this.logger.log(msg);
  }
}
