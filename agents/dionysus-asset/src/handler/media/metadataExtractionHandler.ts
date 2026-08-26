import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { type ExtractMediaMetadataMessage } from "../../types/messages";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { MediaWorkflow } from "../../workflow/media/workflow";
//import { logger } from "../../util/logger";

@Injectable()
export class MetadataExtractionHandler {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.extractMetadata.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.extractMetadata`,
  })
  public async handle(
    msg: ExtractMediaMetadataMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    amqMsg: ConsumeMessage,
  ) {
    logger.debug("MetadataExtractionHandler");
    logger.debug(msg);

    const workflow = new MediaWorkflow(msg.workflowId, msg.mediaExtension);

    try {
      await workflow.extractMetadata(
        "extract_original_metadata",
        "original",
        true,
      );

      await this.amqpConnection.publish(
        "media.trigger",
        `jobType.configureTranscode`,
        {
          workflowId: msg.workflowId,
          mediaExtension: msg.mediaExtension,
        },
        {
          persistent: true,
        },
      );
    } catch (e) {
      logger.error(e);
    }
  }
}
