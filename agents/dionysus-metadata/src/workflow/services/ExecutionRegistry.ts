import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
} from "@nestjs/common";
import { JobApi, MetadataWorkflowApi } from "@ncfritz/olympus-client";
import { JobNotifier } from "./JobNotifier";

export type ExecutionType = "workflow" | "batch";

export type Execution = {
  type: ExecutionType;
  id: string;
};

const logger = new Logger("ExecutionRegistry");

/**
 * The workflows and batch jobs this process is running, so they can be
 * marked failed when it shuts down.
 */
@Injectable()
export class ExecutionRegistry implements BeforeApplicationShutdown {
  private readonly executions: Map<string, Execution> = new Map();

  constructor(
    private readonly workflowApi: MetadataWorkflowApi,
    private readonly jobApi: JobApi,
    private readonly jobNotifier: JobNotifier,
  ) {}

  getExecutions(): Execution[] {
    return Array.from(this.executions.values());
  }

  add(execution: Execution): void {
    this.executions.set(execution.id, execution);
  }

  remove(id: string): void {
    this.executions.delete(id);
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    logger.warn(`Shutting down (${signal ?? "close"})`);
    await this.failOutstanding();
  }

  /** Marks every outstanding workflow and batch job failed. */
  async failOutstanding(): Promise<void> {
    const outstandingTasks = this.getExecutions();
    logger.log(
      `${outstandingTasks.length} outstanding tasks, attempting graceful shutdown`,
    );

    for (const execution of outstandingTasks) {
      try {
        if (execution.type === "workflow") {
          await this.workflowApi.updateMetadataWorkflow(execution.id, {
            status: "failed",
          });
          await this.jobNotifier.sendWorkflowNotification(
            execution.id,
            "failed",
          );
        } else if (execution.type === "batch") {
          await this.jobApi.updateBatchJob(execution.id, {
            status: "failed",
          });
        }
      } catch (e) {
        logger.error(
          `Unable to finalize execution ${execution.type}/${execution.id}`,
          e instanceof Error ? e.stack : String(e),
        );
      }
    }
  }
}
