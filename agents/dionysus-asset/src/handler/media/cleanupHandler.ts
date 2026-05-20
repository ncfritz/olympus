import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { type CleanupMessage } from "../../types/messages";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { createStep, updateStepStatus } from "../../workflow/media/reporter";
import { MediaWorkflow } from "../../workflow/media/workflow";

@Injectable()
export class TranscodeCleanupHandler {
  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.cleanup.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.cleanup`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: CleanupMessage, amqMsg: ConsumeMessage) {
    const workflow = new MediaWorkflow(msg.workflowId, msg.mediaExtension);
    const step = await createStep(workflow.workflowId, "cleanup");

    try {
      //fs.rmSync(`${workflow.stagingDir}/original.${msg.mediaExtension}`);
      await updateStepStatus(workflow.workflowId, step.id, "success", true);
    } catch (e) {
      logger.error(e);
      await updateStepStatus(workflow.workflowId, step.id, "failed");
    }
  }
}
