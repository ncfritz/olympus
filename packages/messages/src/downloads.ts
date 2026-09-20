import { delayedExchange, exchange, route } from "./routing";
import type { MediaAssetType } from "./values";

/**
 * Downloads: the API asks the asset agents to start one; NZBGet's extension
 * scripts (Python, agents/dionysus-search/scripts) report its progress.
 */

export const DOWNLOAD_TRIGGER_EXCHANGE = delayedExchange(
  "download.trigger",
  "direct",
);
export const DOWNLOAD_UPDATE_EXCHANGE = exchange("download.update", "topic");

export interface StartDownloadMessage {
  mediaType: MediaAssetType;
  mediaId: number;
  /** The search result (NZB) to download. */
  resultId: string;
  /**
   * The media workflow the download belongs to. Absent for downloads
   * started on their own (CreateMediaAssetDownload), which the asset
   * agents track but don't stage.
   */
  workflowId?: string;
  downloadId: string;
  nzbId: string;
}

/** `download.start` → queue `download.trigger` */
export const START_DOWNLOAD_ROUTE = route<StartDownloadMessage>(
  DOWNLOAD_TRIGGER_EXCHANGE,
  "download.start",
);

/**
 * NZBGet events. Values are NZBGet's environment variables, so strings or
 * null when unset. The JSON Schema in schemas/download-update.schema.json
 * is generated from these types for the Python publishers.
 */
interface DownloadEventBase {
  /** Event time, nanoseconds since the epoch (time.time_ns()). */
  ts: number;
  nzbFilename: string | null;
  nzbName: string | null;
  category: string | null;
}

/** An NZB was added (scan script). */
export interface DownloadScanEvent extends DownloadEventBase {
  type: "scan";
  nzbDirectory: string | null;
  nzbUrl: string | null;
  priority: string | null;
  top: string | null;
  paused: string | null;
  dupeKey: string | null;
  dupeScore: string | null;
  dupeMode: string | null;
}

/** A queue event: added, downloaded, deleted, ... (queue script). */
export interface DownloadQueueEvent extends DownloadEventBase {
  type: "queue";
  destDirectory: string | null;
  nzbUrl: string | null;
  priority: string | null;
  nzbId: string | null;
  event: string | null;
  status: string | null;
  deleteStatus: string | null;
}

/** Post-processing finished (post-process script). */
export interface DownloadPostProcessEvent extends DownloadEventBase {
  type: "post-process";
  destDirectory: string | null;
  nzbDirectory: string | null;
  status: string | null;
  nzbId: string | null;
  scriptStatus: string | null;
  parStatus: string | null;
  unpackStatus: string | null;
}

export type DownloadUpdateMessage =
  DownloadScanEvent | DownloadQueueEvent | DownloadPostProcessEvent;

/** `update.queue` (every event type) → queue `download.update` (binds `update.*`) */
export const DOWNLOAD_UPDATE_ROUTE = route<DownloadUpdateMessage>(
  DOWNLOAD_UPDATE_EXCHANGE,
  "update.queue",
);
