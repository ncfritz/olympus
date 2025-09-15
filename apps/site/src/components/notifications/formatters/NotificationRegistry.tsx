import { BatchJobCompletionFormatter } from "./dionysus/BatchJobCompletionFormatter";
import { WorkflowCompletionFormatter } from "./dionysus/WorkflowCompletionFormatter";

export const getFormatterForMessageType = (notificationType: string) => {
  switch (notificationType) {
    case "dionysus_batch_job_complete":
      return new BatchJobCompletionFormatter();
    case "dionysus_metadata_workflow_completion":
      return new WorkflowCompletionFormatter();
    default:
      return undefined;
  }
};
