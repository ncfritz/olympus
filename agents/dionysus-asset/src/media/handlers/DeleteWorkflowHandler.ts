import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import fs from "fs";
import { MediaApi } from "@ncfritz/olympus-client";
import { mediaConfig } from "../../config/configuration";
import type { MediaConfigType } from "../../config/configuration";
import {
  type DeleteMediaWorkflowMessage,
  MEDIA_SUBSCRIPTIONS,
} from "../../messaging";

const UUID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

/** Removes a media workflow's staging directory, then the workflow. */
@Injectable()
export class DeleteWorkflowHandler {
  private readonly logger = new Logger(DeleteWorkflowHandler.name);

  constructor(
    @Inject(mediaConfig.KEY) private readonly media: MediaConfigType,
    private readonly mediaApi: MediaApi,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.deleteWorkflow)
  public async handle(msg: DeleteMediaWorkflowMessage): Promise<void> {
    this.logger.debug("DeleteWorkflowHandler");
    this.logger.debug(msg);

    if (!UUID_REGEX.test(msg.workflowId)) {
      this.logger.error(`Invalid workflow ID: ${msg.workflowId}`);
      return;
    }

    const workflowPath = `${this.media.stagingDirectory}/${msg.workflowId}`;

    try {
      if (fs.existsSync(workflowPath)) {
        this.logger.log(
          `Removing staging directory for workflow ${msg.workflowId}`,
        );
        fs.rmSync(workflowPath, { recursive: true, force: true });
      } else {
        this.logger.warn(
          `No directory for workflow ${msg.workflowId} exists, look for ${workflowPath}`,
        );
      }

      await this.mediaApi.deleteMediaAssetWorkflow(msg.workflowId, true);
    } catch (e) {
      this.logger.error(e);
    }
  }
}
