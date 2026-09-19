import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { publishMessage } from "@ncfritz/olympus-messages";
import { Injectable, Logger } from "@nestjs/common";
import {
  type ExtractMediaMetadataMessage,
  MEDIA_ROUTES,
  MEDIA_SUBSCRIPTIONS,
} from "../../messaging";
import { MediaWorkflows } from "../services/MediaWorkflows";

/**
 * Extracts the downloaded original's metadata (ffprobe, HandBrake scan),
 * then asks for its transcode to be configured.
 */
@Injectable()
export class ExtractMetadataHandler {
  private readonly logger = new Logger(ExtractMetadataHandler.name);

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly workflows: MediaWorkflows,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.extractMetadata)
  public async handle(msg: ExtractMediaMetadataMessage): Promise<void> {
    this.logger.debug("MetadataExtractionHandler");
    this.logger.debug(msg);

    const workflow = this.workflows.open(msg.workflowId, msg.mediaExtension);

    try {
      await workflow.extractMetadata(
        "extract_original_metadata",
        "original",
        true,
      );

      await publishMessage(
        this.amqpConnection,
        MEDIA_ROUTES.configureTranscode,
        {
          workflowId: msg.workflowId,
          mediaExtension: msg.mediaExtension,
        },
        {
          persistent: true,
        },
      );
    } catch (e) {
      this.logger.error(e);
    }
  }
}
