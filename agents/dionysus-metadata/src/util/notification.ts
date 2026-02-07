import { BatchJob, WorkflowStatus } from "@ncfritz/olympus-sdk/dionysus";
import { WebSocketNotificationLevel } from "@ncfritz/olympus-sdk/olympus";
import moment from "moment/moment";
import notificationsApi from "../api/notificationsApi";
import { logger } from "./logger";

export const sendWorkflowNotification = async (
  workflowId: string,
  status: WorkflowStatus,
) => {
  try {
    let notificationStatus: WebSocketNotificationLevel = "info";

    switch (status) {
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
        workflowId: workflowId,
        status: status,
      },
    });

    logger.info(`Notification sent for workflow ID: ${workflowId}`);
  } catch (e) {
    logger.warn(
      `Unable to send notification for workflow ID: ${workflowId}`,
      e,
    );
  }
};

export const sendBatchJobNotification = async (
  job: BatchJob,
  workflowId?: string,
) => {
  if (workflowId) {
    logger.info(
      `Job ${job.id} is part of workflow ${workflowId}, notifications will be skipped...`,
    );
    return;
  }

  try {
    let notificationStatus: WebSocketNotificationLevel = "info";

    switch (job.status) {
      case "success":
        notificationStatus = "success";
        break;
      case "failed":
        notificationStatus = "error";
        break;
      case "cancelled":
        notificationStatus = "warning";
        break;
      // CREATED and STARTED are non-terminal states, so just ignore the notification here.
      case "created":
      case "started":
        return;
    }

    await notificationsApi.sendNotification({
      type: "dionysus_batch_job_complete",
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
      context: {
        jobId: job.id,
        jobType: job.type,
        status: job.status,
        recordCounts: {
          total: job.totalRecords,
          processed: job.processedRecords,
          duplicate: job.duplicateRecords,
          new: job.newRecords,
          expired: job.expiredRecords,
          noop: job.noOpRecords,
          skipped: job.skippedRecords,
        },
      },
    });

    logger.info(`Notification sent for job ID: ${job.id}`);
  } catch (e) {
    logger.warn(`Unable to send notification for job ID: ${job?.id}`, e);
  }
};
