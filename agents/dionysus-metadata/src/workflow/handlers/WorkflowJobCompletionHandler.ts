import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import moment from "moment";
import { BatchJobApi } from "../../api/BatchJobApi";
import { WorkflowApi } from "../../api/WorkflowApi";
import {
  type BatchJobCompletionMessage,
  JOB_COMPLETION_SUBSCRIPTION,
  type JobType,
} from "../../messaging";
import { ExecutionRegistry } from "../services/ExecutionRegistry";
import { JobNotifier } from "../services/JobNotifier";

/**
 * Advances a metadata workflow when one of its batch jobs finishes: the next
 * job type on success, a retry from where it stopped on failure (up to three
 * attempts), otherwise the workflow fails.
 */
@Injectable()
export class WorkflowJobCompletionHandler {
  private readonly logger = new Logger(WorkflowJobCompletionHandler.name);

  constructor(
    private readonly workflowApi: WorkflowApi,
    private readonly batchJobApi: BatchJobApi,
    private readonly executions: ExecutionRegistry,
    private readonly jobNotifier: JobNotifier,
  ) {}

  @RabbitSubscribe(JOB_COMPLETION_SUBSCRIPTION)
  public async handle(msg: BatchJobCompletionMessage): Promise<void> {
    if (!msg.workflowId || !msg.stepId) {
      this.logger.error(
        `Received workflow notification for job ${msg.jobId} without a workflowId or stepId... discarding message`,
      );
      return;
    }

    this.logger.debug(
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
        this.logger.log(`Creating next BatchJob in workflow: ${nextJobType}`);
        await this.workflowApi.createWorkflowStep(msg.workflowId, {
          type: "job_execution",
          jobType: nextJobType,
          attempt: 0,
          offset: 0,
        });
      } else {
        this.executions.remove(msg.workflowId);
        // The workflow has ended, mark the workflow as success. If any job has failed, retry logic will have kicked
        // in to attempt successful completion of the job. If the job has exhausted all retry attempts, the job will
        // fail and the workflow will also fail.
        const workflow = await this.workflowApi.updateWorkflow(msg.workflowId, {
          status: "success",
          finishedTime: moment.utc().toISOString(),
        });
        await this.jobNotifier.sendWorkflowNotification(
          workflow.id,
          workflow.status,
        );
      }
    } else if (msg.status === "failed") {
      // If the current attempt is at the retry threshold, we're done, fail the workflow.  If there are still retries
      // that can be attempted, mark the current job as cancelled and create a new step.  The new step should skip
      // the number of records processed so far and increment the attempt.
      if (msg.attempt >= 3) {
        this.executions.remove(msg.workflowId);
        await this.workflowApi.updateWorkflow(msg.workflowId, {
          status: "failed",
          finishedTime: moment.utc().toISOString(),
        });
      } else {
        await this.batchJobApi.updateBatchJob(msg.jobId, {
          status: "cancelled",
          finishedTime: moment.utc().toISOString(),
        });
        await this.workflowApi.createWorkflowStep(msg.workflowId, {
          type: "retry",
          jobType: msg.jobType,
          attempt: msg.attempt + 1,
          offset: msg.recordsProcessed,
        });
      }
    } else {
      this.executions.remove(msg.workflowId);
      const workflow = await this.workflowApi.updateWorkflow(msg.workflowId, {
        status: "failed",
        finishedTime: moment.utc().toISOString(),
      });
      await this.jobNotifier.sendWorkflowNotification(
        workflow.id,
        workflow.status,
      );
    }
  }
}
