import type {
  MediaAssetDownloadStatusUpdate,
  MediaDownloadStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { MediaApi } from "../../api/MediaApi";
import { NzbGetClient } from "./NzbGetClient";

/** NZBGet group statuses → download status. */
export const downloadStatus = (nzbGetStatus: string): MediaDownloadStatus => {
  switch (nzbGetStatus) {
    case "QUEUED":
    case "PAUSED":
      return "pending";
    case "DOWNLOADING":
    case "FETCHING":
    case "PP_QUEUED":
    case "LOADING_PARS":
    case "VERIFYING_SOURCES":
    case "REPAIRING":
    case "VERIFYING_REPAIRED":
    case "RENAMING":
    case "UNPACKING":
    case "MOVING":
    case "EXECUTING_SCRIPT":
    case "PP_FINISHED":
      return "downloading";
    default:
      return "pending";
  }
};

/**
 * Every 2 seconds, copies NZBGet's queue (status and progress of each
 * group) to the downloads.
 */
@Injectable()
export class DownloadStatusPoller {
  constructor(
    private readonly nzbGet: NzbGetClient,
    private readonly mediaApi: MediaApi,
  ) {}

  @Interval(2000)
  async poll(): Promise<void> {
    const rpcResponse = await this.nzbGet.listGroups();

    const updates: MediaAssetDownloadStatusUpdate[] =
      rpcResponse.data.result.map((group) => {
        const fileSize = group.FileSizeMB;
        const remainingSize = group.RemainingSizeMB;

        return {
          nzbId: group.NZBID,
          status: downloadStatus(group.Status),
          progress: ((fileSize - remainingSize) / fileSize) * 100,
        };
      });

    if (updates.length > 0) {
      await this.mediaApi.bulkUpdateMediaAssetDownloads(updates);
    }
  }
}
