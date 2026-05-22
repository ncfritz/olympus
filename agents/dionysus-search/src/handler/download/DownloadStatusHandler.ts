import {
  MediaAssetDownloadStatusUpdate,
  MediaDownloadStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import axios from "axios";
import mediaApi from "../../api/mediaApi";

@Injectable()
export class DownloadStatusHandler {
  constructor(protected readonly configService: ConfigService) {}

  @Interval(2000)
  async handleCron() {
    const nzbGetHost = this.configService.get<string>(
      "NZBGET_HOST",
      "localhost",
    );
    const nzbGetPort = this.configService.get<number>("NZBGET_PORT", 6789);
    const nzbGetUsername = this.configService.get<string>("NZBGET_USERNAME")!;
    const nzbGetPassword = this.configService.get<string>("NZBGET_PASSWORD")!;
    const nzbGetUrl = `http://${nzbGetHost}:${nzbGetPort}/jsonrpc`;

    const rpcResponse = await axios.post(
      nzbGetUrl,
      {
        id: 1,
        jsonrpc: "2.0",
        method: "listgroups",
        params: [0],
      },
      {
        auth: { username: nzbGetUsername, password: nzbGetPassword },
      },
    );

    const updates: MediaAssetDownloadStatusUpdate[] = [];

    rpcResponse.data.result.forEach((group: any) => {
      let status: MediaDownloadStatus;

      switch (group.Status) {
        case "QUEUED":
        case "PAUSED":
          status = "pending";
          break;
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
          status = "downloading";
          break;
        default:
          status = "pending";
      }

      const fileSize = group.FileSizeMB;
      const remainingSize = group.RemainingSizeMB;

      const progress = ((fileSize - remainingSize) / fileSize) * 100;

      updates.push({
        nzbId: group.NZBID,
        status: status,
        progress: progress,
      });
    });

    if (updates.length > 0) {
      await mediaApi.bulkUpdateMediaAssetDownloads(updates);
    }
  }
}
