import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import { JobType } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import moment from "moment";
import batchJobApi from "../../api/batchJobApi";
import workflowApi from "../../api/workflowApi";
import { type BatchJobWorkflowMessage } from "../../types/message";

import {
  BATCH_JOB_WORKFLOW_EXCHANGE,
  METADATA_JOB_PREFIX,
  WORKFLOW_SUFFIX,
} from "../../util/constants";
import { removeExecution } from "../../util/executionHolder";
import { logger } from "../../util/logger";
import { sendWorkflowNotification } from "../../util/notification";

@Injectable()
export class WorkflowJobCompletionHandler {
  @RabbitSubscribe({
    exchange: `${BATCH_JOB_WORKFLOW_EXCHANGE}`,
    queue: `${METADATA_JOB_PREFIX}.${WORKFLOW_SUFFIX}.jobNotification`,
    routingKey: "jobCompletion",
    queueOptions: {
      channel: "workflowChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: BatchJobWorkflowMessage, amqpMsg: ConsumeMessage) {
    if (!msg.workflowId || !msg.stepId) {
      logger.error(
        `Received workflow notification for job ${msg.jobId} without a workflowId or stepId... discarding message`,
      );
      return;
    }

    logger.debug(
      `Workflow notification for job ${msg.jobId} - ${msg.jobType} in status ${msg.status}. Workflow: ${msg.workflowId}, Step: ${msg.stepId}`,
    );

    if (msg.status === "success") {
      let nextJobType: JobType | undefined = undefined;

      switch (msg.jobType) {
        case "languages":
          nextJobType = "countries";
          break;
        case "countries":
          nextJobType = "certifications";
          break;
        case "certifications":
          nextJobType = "genres";
          break;
        case "genres":
          nextJobType = "production_companies";
          break;
        case "production_companies":
          nextJobType = "keywords";
          break;
        case "keywords":
          nextJobType = "tv_networks";
          break;
        case "tv_networks":
          nextJobType = "collections";
          break;
        case "collections":
          nextJobType = "people";
          break;
        case "people":
          nextJobType = "tv_series";
          break;
        case "tv_series":
          nextJobType = "movies";
          break;
        case "movies":
          // End of the workflow
          break;
      }

      if (nextJobType) {
        logger.info(`Creating next BatchJob in workflow: ${nextJobType}`);
        await workflowApi.createWorkflowStep(msg.workflowId, {
          type: "job_execution",
          jobType: nextJobType,
          attempt: 0,
          offset: 0,
        });
      } else {
        removeExecution(msg.workflowId);
        // The workflow has ended, mark the workflow as success. If any job has failed, retry logic will have kicked
        // in to attempt successful completion of the job. If the job has exhausted all retry attempts, the job will
        // fail and the workflow will also fail.
        const workflow = await workflowApi.updateWorkflow(msg.workflowId, {
          status: "success",
          finishedTime: moment.utc().toISOString(),
        });
        await sendWorkflowNotification(workflow.id, workflow.status);
      }
    } else if (msg.status === "failed") {
      // If the current attempt is at the retry threshold, we're done, fail the workflow.  If there are still retries
      // that can be attempted, mark the current job as cancelled and create a new step.  The new step should skip
      // the number of records processed so far and increment the attempt.
      if (msg.attempt >= 3) {
        removeExecution(msg.workflowId);
        await workflowApi.updateWorkflow(msg.workflowId, {
          status: "failed",
          finishedTime: moment.utc().toISOString(),
        });
      } else {
        await batchJobApi.updateBatchJob(msg.jobId, {
          status: "cancelled",
          finishedTime: moment.utc().toISOString(),
        });
        await workflowApi.createWorkflowStep(msg.workflowId, {
          type: "retry",
          jobType: msg.jobType,
          attempt: msg.attempt + 1,
          offset: msg.recordsProcessed,
        });
      }
    } else {
      removeExecution(msg.workflowId);
      const workflow = await workflowApi.updateWorkflow(msg.workflowId, {
        status: "failed",
        finishedTime: moment.utc().toISOString(),
      });
      await sendWorkflowNotification(workflow.id, workflow.status);
    }
  }
}
