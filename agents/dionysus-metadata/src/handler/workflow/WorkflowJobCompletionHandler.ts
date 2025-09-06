import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import { JobType, Workflow } from "@ncfritz/olympus-sdk/dionysus";
import { WebSocketNotificationLevel } from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import moment from "moment";
import batchJobApi from "../../api/batchJobApi";
import notificationsApi from "../../api/notificationsApi";
import workflowApi from "../../api/workflowApi";
import { type BatchJobWorkflowMessage } from "../../types/message";

import {
  BATCH_JOB_WORKFLOW_EXCHANGE,
  METADATA_JOB_PREFIX,
  WORKFLOW_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";

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
        // The workflow has ended, mark the workflow as success. If any job has failed, retry logic will have kicked
        // in to attempt successful completion of the job. If the job has exhausted all retry attempts, the job will
        // fail and the workflow will also fail.
        const workflow = await workflowApi.updateWorkflow(msg.workflowId, {
          status: "success",
          finishedTime: moment.utc().toISOString(),
        });
        await this.notify(workflow, msg);
      }
    } else if (msg.status === "failed") {
      // If the current attempt is at the retry threshold, we're done, fail the workflow.  If there are still retries
      // that can be attempted, mark the current job as cancelled and create a new step.  The new step should skip
      // the number of records processed so far and increment the attempt.
      if (msg.attempt >= 3) {
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
      const workflow = await workflowApi.updateWorkflow(msg.workflowId, {
        status: "failed",
        finishedTime: moment.utc().toISOString(),
      });
      await this.notify(workflow, msg);
    }
  }

  private async notify(
    workflow: Workflow,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    msg: BatchJobWorkflowMessage,
  ): Promise<void> {
    try {
      let notificationStatus: WebSocketNotificationLevel = "info";

      switch (workflow.status) {
        case "success":
          notificationStatus = "success";
          break;
        case "failed":
          notificationStatus = "error";
          break;
        // CREATED and STARTED are non-terminal states, so just ignore the notification here.
        case "created":
        case "started":
          return;
      }

      await notificationsApi.sendNotification({
        type: "dionysus_metadata_workflow_completion",
        expirationTime: moment().add(3, "hours").toISOString(),
        webSocketDestination: {
          level: notificationStatus,
          visibleDuration: 15,
          ghost: false,
          group: "dionysus",
          durable: true,
          ttl: "P7D",
          closable: true,
          deleteOnClose: false,
        },
        synoMailDestination: {
          from: "dionysus@internal.ncfritz.net",
          to: [{ value: "ncfritz@internal.ncfritz.net" }],
        },
        smtpDestination: {
          from: "dionysus@ncfritz.net",
          to: [{ value: "ncfritz@ncfritz.net" }],
        },
        context: {
          workflowId: workflow.id,
          status: workflow.status,
        },
      });

      logger.info(`Notification sent for workflow ID: ${workflow.id}`);
    } catch (e) {
      logger.warn(
        `Unable to send notification for workflow ID: ${workflow?.id}`,
        e,
      );
    }
  }
}
