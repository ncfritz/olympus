import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import fs from "fs";
import moment from "moment";
import { finished } from "node:stream/promises";
import { MediaApi } from "../../api/MediaApi";
import { mediaConfig } from "../../config/configuration";
import type { MediaConfigType } from "../../config/configuration";
import {
  DOWNLOAD_SUBSCRIPTIONS,
  type StartDownloadMessage,
} from "../../messaging";
import type { MediaAssetType } from "@ncfritz/olympus-messages";
import { nzbMetadata } from "../nzb/metadata";
import parse from "../nzb/parser";
import { NzbFailureError } from "../services/NzbFailureError";
import { NzbGeekClient } from "../services/NzbGeekClient";
import { NzbGetClient } from "../services/NzbGetClient";

/**
 * Starts a download: fetches the release's NZB from NZBGeek, queues it in
 * NZBGet and records its NZB id, and writes the NZB's metadata to the
 * workflow's staging directory (nzbMeta.json).
 */
@Injectable()
export class StartDownloadHandler {
  private readonly logger = new Logger(StartDownloadHandler.name);

  constructor(
    @Inject(mediaConfig.KEY) private readonly media: MediaConfigType,
    private readonly mediaApi: MediaApi,
    private readonly nzbGeek: NzbGeekClient,
    private readonly nzbGet: NzbGetClient,
  ) {}

  @RabbitSubscribe(DOWNLOAD_SUBSCRIPTIONS.start)
  public async handle(msg: StartDownloadMessage): Promise<void> {
    this.logger.log(
      `StartDownloadHandler: Starting download for nzbId: ${msg.nzbId}`,
    );

    const stagingDir = this.media.stagingDirectory;
    const nzbFilename = `/tmp/${msg.nzbId}.nzb`;

    const writer = fs.createWriteStream(nzbFilename);
    const nzbStream = await this.nzbGeek.getNzb(msg.nzbId);
    nzbStream.pipe(writer);
    await finished(writer);

    this.logger.debug(`NZB file downloaded to ${nzbFilename}`);
    this.logger.debug("Parsing NZB...");

    const rawNzb = fs.readFileSync(nzbFilename, "utf8");
    const nzb = parse(rawNzb);
    const metadata = nzbMetadata(nzb);

    try {
      const rpcResponse = await this.nzbGet.append(nzb.file.name, rawNzb);

      this.logger.debug(
        `Got ${rpcResponse.status} HTTP response, NZBGet result (${rpcResponse.data.result}) from NZBGet: ${this.nzbGet.url}`,
      );
      this.logger.debug(`NZBGet response: ${JSON.stringify(rpcResponse.data)}`);

      if (rpcResponse.data.result !== false && rpcResponse.data.result >= 0) {
        await this.mediaApi.updateMediaAssetDownload(
          msg.mediaType,
          msg.mediaId,
          msg.resultId,
          msg.downloadId,
          {
            nzbId: rpcResponse.data.result as number,
          },
        );

        if (!fs.existsSync(`${stagingDir}/${msg.workflowId}`)) {
          this.logger.debug(
            `Creating workflow directory: ${stagingDir}/${msg.workflowId}`,
          );
          fs.mkdirSync(`${stagingDir}/${msg.workflowId}`, { recursive: true });
        }

        this.logger.log(
          `Writing NZB metadata to ${stagingDir}/${msg.workflowId}/nzbMeta.json`,
        );
        fs.writeFileSync(
          `${stagingDir}/${msg.workflowId}/nzbMeta.json`,
          JSON.stringify(metadata),
        );
      } else {
        this.logger.error(
          `Failed to add NZB to NZBGet: ${rpcResponse.data.error}`,
        );

        throw new NzbFailureError(`${rpcResponse.data.error}`);
      }
    } catch (e) {
      this.logger.error(
        `Error processing download update message: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );

      try {
        await this.failDownload(
          msg.workflowId!,
          msg.mediaType,
          msg.mediaId,
          msg.resultId,
          msg.downloadId,
        );
      } catch (innerError) {
        this.logger.error(
          `Error updating download: ${innerError instanceof Error ? innerError.message : String(innerError)}`,
          innerError instanceof Error ? innerError.stack : undefined,
        );
      }
    }
  }

  private async failDownload(
    workflowId: string,
    mediaType: MediaAssetType,
    mediaId: number,
    resultId: string,
    downloadId: string,
  ) {
    const now = moment.utc();
    await this.mediaApi.updateMediaAssetDownload(
      mediaType,
      mediaId,
      resultId,
      downloadId,
      {
        status: "failed",
        finishedTime: now.toISOString(),
      },
    );

    await this.mediaApi.updateMediaAssetWorkflow(workflowId, {
      status: "failed",
      finishedTime: now.toISOString(),
    });
  }
}
