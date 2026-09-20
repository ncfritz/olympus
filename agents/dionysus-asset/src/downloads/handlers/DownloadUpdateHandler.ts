import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { publishMessage } from "@ncfritz/olympus-messages";
import type {
  MediaDownloadStatus,
  PartialMediaAssetDownload,
  SearchResultStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Inject, Injectable, Logger } from "@nestjs/common";
import fs from "fs";
import moment from "moment";
import { MediaApi } from "../../api/MediaApi";
import { downloadsConfig, mediaConfig } from "../../config/configuration";
import type {
  DownloadsConfigType,
  MediaConfigType,
} from "../../config/configuration";
import {
  DOWNLOAD_SUBSCRIPTIONS,
  type DownloadUpdateMessage,
  MEDIA_ROUTES,
} from "../../messaging";
import { NzbGetClient } from "../services/NzbGetClient";

const MEDIA_EXTENSIONS = [
  "mp4",
  "m4v",
  "mov",
  "qt",
  "mkv",
  "mk3d",
  "webm",
  "avi",
  "wmv",
  "flv",
  "f4v",
];

/**
 * NZBGet's events (from its extension scripts): marks downloads started,
 * cancelled, finished or failed; a finished download's media file moves to
 * the workflow's staging directory as its original, and its metadata
 * extraction starts.
 */
@Injectable()
export class DownloadUpdateHandler {
  private readonly logger = new Logger(DownloadUpdateHandler.name);

  constructor(
    @Inject(mediaConfig.KEY) private readonly media: MediaConfigType,
    @Inject(downloadsConfig.KEY)
    private readonly downloads: DownloadsConfigType,
    private readonly amqpConnection: AmqpConnection,
    private readonly mediaApi: MediaApi,
    private readonly nzbGet: NzbGetClient,
  ) {}

  @RabbitSubscribe(DOWNLOAD_SUBSCRIPTIONS.update)
  public async handle(msg: DownloadUpdateMessage): Promise<void> {
    // Scan events have no NZB id or event (NaN: they aren't handled).
    const event = msg as { nzbId?: string | null; event?: string | null };
    this.logger.log(
      `DownloadUpdateHandler: Starting update for nzbId: ${event.nzbId}`,
    );

    const ts = msg.ts;
    const nzbId = parseInt(event.nzbId!);
    const stagingDir = this.media.stagingDirectory;

    try {
      if (this.downloads.persistEvents) {
        const filePath = `${this.downloads.eventsDirectory}/${ts}.json`;
        fs.writeFileSync(filePath, JSON.stringify(msg, null, 2));
      }

      this.logger.debug(
        `Got message with type "${msg.type}" and event "${event.event}"`,
      );

      if (msg.type === "queue") {
        if (msg.event === "NZB_NAMED" || msg.event === "NZB_ADDED") {
          await this.updateDownloadStatus(
            nzbId,
            {
              status: "downloading",
              startedTime: moment.utc().toISOString(),
            },
            "downloading",
          );
        } else if (msg.event === "NZB_DELETED" && msg.deleteStatus === "COPY") {
          await this.failDownload(nzbId, "cancelled", false);
        }
      } else if (msg.type === "post-process") {
        if (msg.status!.startsWith("SUCCESS")) {
          const download = await this.updateDownloadStatus(
            nzbId,
            {
              status: "success",
              progress: 100,
              finishedTime: moment.utc().toISOString(),
            },
            "downloaded",
          );

          if (!download) {
            this.logger.warn(
              `Download with nzbId ${nzbId} does not map to a Dionysus download, skipping`,
            );
            return;
          }

          // Started on its own (CreateMediaAssetDownload): nothing to
          // stage or transcode, so the files stay where NZBGet put them.
          if (!download.workflowId) {
            this.logger.log(
              `Download with nzbId ${nzbId} has no workflow, leaving it in ${msg.destDirectory}`,
            );
            return;
          }

          if (!fs.existsSync(`${stagingDir}/${download.workflowId}`)) {
            fs.mkdirSync(`${stagingDir}/${download.workflowId}`, {
              recursive: true,
            });
          }

          const usenetFiles = fs.readdirSync(msg.destDirectory!);
          this.logger.debug(`Usenet files: ${JSON.stringify(usenetFiles)}`);

          const mediaFilenames = usenetFiles.filter((filename) => {
            const extension = filename.split(".").pop();
            return MEDIA_EXTENSIONS.includes(extension!);
          });
          this.logger.log(`Media filenames: ${JSON.stringify(mediaFilenames)}`);

          if (!mediaFilenames || mediaFilenames.length === 0) {
            await this.failDownload(nzbId, "failed");

            return;
          } else if (mediaFilenames?.length > 0) {
            this.logger.warn(
              `Multiple media filenames found, this should not happen: ${JSON.stringify(mediaFilenames)}`,
            );
          }

          const mediaFilename = mediaFilenames[0];
          this.logger.log(`Media filename: ${mediaFilename}`);

          const originalExtension = mediaFilename.split(".").pop();

          this.logger.log("Moving asset to staging directory:");
          this.logger.debug(
            `\t   Original: ${msg.destDirectory}/${mediaFilename}`,
          );
          this.logger.debug(
            `\tDestination: ${stagingDir}/${download.workflowId}/original.${originalExtension}`,
          );

          fs.renameSync(
            `${msg.destDirectory}/${mediaFilename}`,
            `${stagingDir}/${download.workflowId}/original.${originalExtension}`,
          );

          this.logger.debug(
            `Publishing "media.trigger" message for workflow ${download.workflowId}`,
          );

          await publishMessage(
            this.amqpConnection,
            MEDIA_ROUTES.extractMetadata,
            {
              workflowId: download.workflowId,
              mediaType: "original",
              mediaExtension: originalExtension!,
            },
            {
              persistent: true,
            },
          );

          await this.nzbGet.deleteHistory(nzbId);
        } else if (msg.status!.startsWith("FAILURE")) {
          await this.failDownload(nzbId, "failed");
        }
      }
    } catch (e) {
      this.logger.error(
        `Error processing download update message: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );

      await this.failDownload(nzbId, "failed");
    }
  }

  private async failDownload(
    nzbId: number,
    downloadStatus: MediaDownloadStatus,
    cleanupNzb = true,
  ) {
    const now = moment.utc();

    try {
      const downloadUpdate: PartialMediaAssetDownload = {
        status: downloadStatus,
        finishedTime: now.toISOString(),
      };

      if (downloadStatus === "cancelled") {
        downloadUpdate.startedTime = moment.utc().toISOString();
      }

      const updatedDownload = await this.updateDownloadStatus(
        nzbId,
        downloadUpdate,
        "download_failed",
      );

      if (updatedDownload && updatedDownload.workflowId) {
        await this.mediaApi.updateMediaAssetWorkflow(
          updatedDownload.workflowId,
          {
            status: "failed",
            finishedTime: now.toISOString(),
          },
        );
      } else {
        this.logger.warn(
          `Download for NZB ${nzbId} is not associated with a workflow, skipping update`,
        );
      }

      if (cleanupNzb) {
        await this.nzbGet.deleteHistory(nzbId);
      }
    } catch (e) {
      this.logger.error(
        `Error updating download status: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  /** @returns the download; undefined when no download has this NZB id */
  private async updateDownloadStatus(
    nzbId: number,
    updates: PartialMediaAssetDownload,
    searchResultStatus: SearchResultStatus,
  ) {
    const response = await this.mediaApi.updateMediaAssetDownloadByNzbId(
      nzbId as number,
      updates,
      searchResultStatus,
    );

    if (response.status === 404) {
      this.logger.warn(
        `Download with nzbId ${nzbId} not found, skipping update`,
      );
      return undefined;
    }

    return response.data.download;
  }
}
