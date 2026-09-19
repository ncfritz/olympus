import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import moment from "moment";
import { WorkflowApi } from "../../api/WorkflowApi";
import {
  START_WORKFLOW_SUBSCRIPTION,
  type StartWorkflowMessage,
} from "../../messaging";
import { ExecutionRegistry } from "../services/ExecutionRegistry";

/** Starts a metadata workflow: its first step loads languages. */
@Injectable()
export class StartWorkflowHandler {
  private readonly logger = new Logger(StartWorkflowHandler.name);

  constructor(
    private readonly workflowApi: WorkflowApi,
    private readonly executions: ExecutionRegistry,
  ) {}

  @RabbitSubscribe(START_WORKFLOW_SUBSCRIPTION)
  public async handle(msg: StartWorkflowMessage): Promise<void> {
    this.logger.debug(`Starting workflow ${msg.workflowId}`);

    await this.workflowApi.updateWorkflow(msg.workflowId, {
      status: "started",
      startedTime: moment.utc().toISOString(),
    });
    this.executions.add({ id: msg.workflowId, type: "workflow" });

    // The API will take care of sending the job notification message.  Once the job completes the
    // WorkflowJobCompletionHandler will take care of running the next stage of the workflow.
    await this.workflowApi.createWorkflowStep(msg.workflowId, {
      type: "job_execution",
      jobType: "languages",
      attempt: 0,
      offset: 0,
    });
  }
}
