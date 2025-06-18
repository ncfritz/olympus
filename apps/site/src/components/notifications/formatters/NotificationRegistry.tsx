import { BatchJobCompletionFormatter } from "./dionysus/BatchJobCompletionFormatter";

export const getFormatterForMeaageType = (notificationType: string) => {
  switch (notificationType) {
    case "dionysus_batch_job_complete":
      return new BatchJobCompletionFormatter();
    default:
      return undefined;
  }
};
