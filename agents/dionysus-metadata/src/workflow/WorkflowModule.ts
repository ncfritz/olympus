import { Module } from "@nestjs/common";
import { StartWorkflowHandler } from "./handlers/StartWorkflowHandler";
import { WorkflowJobCompletionHandler } from "./handlers/WorkflowJobCompletionHandler";
import { ExecutionRegistry } from "./services/ExecutionRegistry";
import { JobNotifier } from "./services/JobNotifier";

/**
 * Metadata workflows: the chain of batch jobs from languages to movies, and
 * the notifications and bookkeeping of running jobs.
 */
@Module({
  providers: [
    ExecutionRegistry,
    JobNotifier,
    StartWorkflowHandler,
    WorkflowJobCompletionHandler,
  ],
  exports: [ExecutionRegistry, JobNotifier],
})
export class WorkflowModule {}
