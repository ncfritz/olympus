import { exchange, route } from "./routing";
import type { ContentJobType } from "./values";

/** Content assets: ingestion and processing jobs (API → asset agents). */

export const CONTENT_TRIGGER_EXCHANGE = exchange("content.trigger", "topic");

/** Ingest a file into the content library. */
export interface RawIngestionMessage {
  workflowId: string;
  /** Where the asset agents find the file. */
  assetLocation: string;
  originalFilename?: string;
  skipWorkflow?: boolean;
}

/** `jobType.rawIngest` → queue `content.rawIngest.trigger` */
export const RAW_INGEST_ROUTE = route<RawIngestionMessage>(
  CONTENT_TRIGGER_EXCHANGE,
  "jobType.rawIngest",
);

/** Process an existing asset (HLS, thumbnails, delete). */
export interface ContentAssetJobMessage {
  assetId: string;
}

/** `jobType.<type>` → queue `content.<type>.trigger` */
export const contentJobRoute = (jobType: ContentJobType) =>
  route<ContentAssetJobMessage>(CONTENT_TRIGGER_EXCHANGE, `jobType.${jobType}`);
