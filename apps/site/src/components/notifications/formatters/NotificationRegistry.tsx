import { BatchJobCompletionFormatter } from "./dionysus/BatchJobCompletionFormatter";
import { MediaAssetSearchRefreshCompletionFormatter } from "./dionysus/MediaAssetSearchRefreshCompletionFormatter";
import { WorkflowCompletionFormatter } from "./dionysus/WorkflowCompletionFormatter";

export const getFormatterForMessageType = (notificationType: string) => {
  switch (notificationType) {
    case "dionysus_batch_job_complete":
      return new BatchJobCompletionFormatter();
    case "dionysus_metadata_workflow_completion":
      return new WorkflowCompletionFormatter();
    case "dionysus_media_asset_search_refresh_complete":
      return new MediaAssetSearchRefreshCompletionFormatter();
    default:
      return undefined;
  }
};
