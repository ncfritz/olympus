import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  WorkflowStatus,
  WorkflowStepType,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import moment from "moment";
import workflowApi from "../../api/workflowApi";
import { StartWorkflowMessage } from "../../types/message";
import {
  BATCH_JOB_WORKFLOW_EXCHANGE,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
  WORKFLOW_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";

@Injectable()
export class StartWorkflowHandler {
  @RabbitSubscribe({
    exchange: `${BATCH_JOB_WORKFLOW_EXCHANGE}`,
    queue: `${METADATA_JOB_PREFIX}.${WORKFLOW_SUFFIX}.${TRIGGER_SUFFIX}`,
    routingKey: "workflowCreated",
    queueOptions: {
      channel: "workflowChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: StartWorkflowMessage, amqpMsg: ConsumeMessage) {
    logger.debug(`Starting workflow ${msg.workflowId}`, msg);

    await workflowApi.updateWorkflow(msg.workflowId, {
      status: WorkflowStatus.STARTED,
      startedTime: moment.utc(),
    });

    // The API will take care of sending the job notification message.  Once the job completes the
    // WorkflowJobCompletionHandler will take care of running the next stage of the workflow.
    await workflowApi.createWorkflowStep(
      msg.workflowId,
      WorkflowStepType.JOB_EXECUTION,
      JobType.LANGUAGES,
      { attempt: 0, offset: 0 },
    );
  }
}
