import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import fs from "fs";
import mediaApi from "../../api/mediaApi";
import { type DeleteMediaWorkflowMessage } from "../../types/messages";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";

const UUID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

@Injectable()
export class DeleteWorkflowHandler {
  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.deleteWorkflow.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.deleteWorkflow`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: DeleteMediaWorkflowMessage, amqMsg: ConsumeMessage) {
    logger.debug("DeleteWorkflowHandler");
    logger.debug(msg);

    if (!UUID_REGEX.test(msg.workflowId)) {
      logger.error(`Invalid workflow ID: ${msg.workflowId}`);
      return;
    }

    const workflowPath = `${process.env.STAGING_DIRECTORY}/${msg.workflowId}`;

    try {
      if (fs.existsSync(workflowPath)) {
        logger.info(
          `Removing staging directory for workflow ${msg.workflowId}`,
        );
        fs.rmSync(workflowPath, { recursive: true, force: true });
      } else {
        logger.warn(
          `No directory for workflow ${msg.workflowId} exists, look for ${workflowPath}`,
        );
      }

      await mediaApi.deleteMediaAssetWorkflow(msg.workflowId, true);
    } catch (e) {
      logger.error(e);
    }
  }
}
