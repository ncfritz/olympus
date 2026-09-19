import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import fs from "fs";
import {
  MEDIA_SUBSCRIPTIONS,
  type MediaWorkflowFileMessage,
} from "../../messaging";
import { MediaReporter } from "../services/MediaReporter";
import { MediaWorkflows } from "../services/MediaWorkflows";

/** Removes the original after a transcode; the workflow's last step. */
@Injectable()
export class CleanupHandler {
  private readonly logger = new Logger(CleanupHandler.name);

  constructor(
    private readonly reporter: MediaReporter,
    private readonly workflows: MediaWorkflows,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.cleanup)
  public async handle(msg: MediaWorkflowFileMessage): Promise<void> {
    this.logger.debug("TranscodeCleanupHandler");
    this.logger.debug(msg);

    const workflow = this.workflows.open(msg.workflowId, msg.mediaExtension);
    const step = await this.reporter.createStep(workflow.workflowId, "cleanup");

    try {
      fs.rmSync(`${workflow.stagingDir}/original.${msg.mediaExtension}`);
      await this.reporter.updateStepStatus(
        workflow.workflowId,
        step.id,
        "success",
        true,
      );
    } catch (e) {
      this.logger.error(e);
      await this.reporter.updateStepStatus(
        workflow.workflowId,
        step.id,
        "failed",
      );
    }
  }
}
