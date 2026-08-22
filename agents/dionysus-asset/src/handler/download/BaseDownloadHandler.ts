import {
  PartialMediaAssetDownload,
  SearchResultStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import mediaApi from "../../api/mediaApi";
import { logger } from "../../util/logger";

export abstract class BaseDownloadHandler {
  protected readonly nzbGetUrl: string;
  protected readonly nzbGetUsername: string;
  protected readonly nzbGetPassword: string;

  constructor(protected readonly configService: ConfigService) {
    const nzbGetHost = this.configService.get<string>(
      "NZBGET_HOST",
      "localhost",
    );
    const nzbGetPort = this.configService.get<number>("NZBGET_PORT", 6789);

    this.nzbGetUrl = `http://${nzbGetHost}:${nzbGetPort}/jsonrpc`;
    this.nzbGetUsername = this.configService.get<string>("NZBGET_USERNAME")!;
    this.nzbGetPassword = this.configService.get<string>("NZBGET_PASSWORD")!;
  }

  protected async updateDownloadStatus(
    nzbId: number,
    updates: PartialMediaAssetDownload,
    searchResultStatus: SearchResultStatus,
  ) {
    const response = await mediaApi.updateMediaAssetDownloadByNzbId(
      nzbId as number,
      updates,
      searchResultStatus,
    );

    if (response.status === 404) {
      logger.warn(`Download with nzbId ${nzbId} not found, skipping update`);
      return undefined;
    }

    return response.data.download;
  }

  protected async deleteNzbHistory(nzbId: number) {
    await axios.post(
      this.nzbGetUrl,
      {
        id: 1,
        jsonrpc: "2.0",
        method: "editqueue",
        params: ["GroupFinalDelete", 0, "", [nzbId]],
      },
      {
        auth: { username: this.nzbGetUsername, password: this.nzbGetPassword },
      },
    );
  }
}
