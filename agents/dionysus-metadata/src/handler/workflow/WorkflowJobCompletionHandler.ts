import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobStatus,
  JobType,
  Workflow,
  WorkflowStatus,
  WorkflowStepType,
} from "@ncfritz/olympus-model";
import { WebSocketNotificationLevel } from "@ncfritz/olympus-model/dist/notifications";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import moment from "moment";
import batchJobApi from "../../api/batchJobApi";
import notificationsApi from "../../api/notificationsApi";
import workflowApi from "../../api/workflowApi";
import { BatchJobWorkflowMessage } from "../../types/message";

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

    if (msg.status === JobStatus.SUCCESS) {
      let nextJobType: JobType | undefined = undefined;

      switch (msg.jobType) {
        case JobType.LANGUAGES:
          nextJobType = JobType.COUNTRIES;
          break;
        case JobType.COUNTRIES:
          nextJobType = JobType.CERTIFICATIONS;
          break;
        case JobType.CERTIFICATIONS:
          nextJobType = JobType.GENRES;
          break;
        case JobType.GENRES:
          nextJobType = JobType.PRODUCTION_COMPANIES;
          break;
        case JobType.PRODUCTION_COMPANIES:
          nextJobType = JobType.KEYWORDS;
          break;
        case JobType.KEYWORDS:
          nextJobType = JobType.TV_NETWORKS;
          break;
        case JobType.TV_NETWORKS:
          nextJobType = JobType.COLLECTIONS;
          break;
        case JobType.COLLECTIONS:
          nextJobType = JobType.PEOPLE;
          break;
        case JobType.PEOPLE:
          nextJobType = JobType.TV_SERIES;
          break;
        case JobType.TV_SERIES:
          nextJobType = JobType.MOVIES;
          break;
        case JobType.MOVIES:
          // End of the workflow
          break;
      }

      if (nextJobType) {
        logger.info(`Creating next BatchJob in workflow: ${nextJobType}`);
        await workflowApi.createWorkflowStep(
          msg.workflowId,
          WorkflowStepType.JOB_EXECUTION,
          nextJobType,
        );
      } else {
        // The workflow has ended, mark the workflow as success. If any job has failed, retry logic will have kicked
        // in to attempt successful completion of the job. If the job has exhausted all retry attempts, the job will
        // fail and the workflow will also fail.
        const workflow = await workflowApi.updateWorkflow(msg.workflowId, {
          status: WorkflowStatus.SUCCESS,
          finishedTime: moment.utc(),
        });
        await this.notify(workflow, msg);
      }
    } else if (msg.status === JobStatus.FAILED) {
      // If the current attempt is at the retry threshold, we're done, fail the workflow.  If there are still retries
      // that can be attempted, mark the current job as cancelled and create a new step.  The new step should skip
      // the number of records processed so far and increment the attempt.
      if (msg.attempt >= 3) {
        await workflowApi.updateWorkflow(msg.workflowId, {
          status: WorkflowStatus.FAILED,
          finishedTime: moment.utc(),
        });
      } else {
        await batchJobApi.updateBatchJob(msg.jobId, {
          status: JobStatus.CANCELLED,
          finishedTime: moment.utc(),
        });
        await workflowApi.createWorkflowStep(
          msg.workflowId,
          WorkflowStepType.RETRY,
          msg.jobType,
          {
            attempt: msg.attempt + 1,
            offset: msg.recordsProcessed,
          },
        );
      }
    } else {
      const workflow = await workflowApi.updateWorkflow(msg.workflowId, {
        status: WorkflowStatus.FAILED,
        finishedTime: moment.utc(),
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
      let notificationStatus: WebSocketNotificationLevel =
        WebSocketNotificationLevel.INFO;

      switch (workflow.status) {
        case WorkflowStatus.SUCCESS:
          notificationStatus = WebSocketNotificationLevel.SUCCESS;
          break;
        case WorkflowStatus.FAILED:
          notificationStatus = WebSocketNotificationLevel.ERROR;
          break;
        // CREATED and STARTED are non-terminal states, so just ignore the notification here.
        case WorkflowStatus.CREATED:
        case WorkflowStatus.STARTED:
          return;
      }

      await notificationsApi.sendNotification({
        type: "dionysus_metadata_workflow_completion",
        expirationTime: moment().add(3, "hours").toISOString(),
        webSocketDestination: {
          level: notificationStatus,
          visibleDuration: 15,
          ghost: false,
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
