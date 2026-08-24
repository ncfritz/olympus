import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  MediaDownloadStatus,
  PartialMediaAssetDownload,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ConsumeMessage } from "amqplib";
import fs from "fs";
import moment from "moment";
import mediaApi from "../../api/mediaApi";
import {
  DOWNLOAD_PREFIX,
  DOWNLOAD_UPDATE_EXCHANGE,
  UPDATE_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { BaseDownloadHandler } from "./BaseDownloadHandler";

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

@Injectable()
export class DownloadUpdateHandler extends BaseDownloadHandler {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    protected readonly configService: ConfigService,
  ) {
    super(configService);
  }

  @RabbitSubscribe({
    exchange: DOWNLOAD_UPDATE_EXCHANGE,
    queue: `${DOWNLOAD_PREFIX}.${UPDATE_SUFFIX}`,
    routingKey: `${UPDATE_SUFFIX}.*`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: any, amqMsg: ConsumeMessage) {
    logger.info(
      `DownloadUpdateHandler: Starting update for nzbId: ${msg.nzbId}`,
    );

    const ts = msg.ts;
    const nzbId = parseInt(msg.nzbId);
    const stagingDir = process.env.STAGING_DIRECTORY!;

    try {
      if (process.env.PERSIST_EVENTS === "true") {
        const filePath = `${process.env.EVENTS_DIRECTORY}/${ts}.json`;
        fs.writeFileSync(filePath, JSON.stringify(msg, null, 2));
      }

      logger.debug(
        `Got message with type "${msg.type}" and event "${msg.event}"`,
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
        } else if (
          msg.event === "NZB_DELETED" &&
          msg.deleteStatus === "COPY"
        ) {
          await this.failDownload(nzbId, "cancelled", false);
        }
      } else if (msg.type === "post-process") {
        if (msg.status.startsWith("SUCCESS")) {
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
            logger.warn(
              `Download with nzbId ${nzbId} does not map to a Dionysus download, skipping`,
            );
            return;
          }

          if (!fs.existsSync(`${stagingDir}/${download.workflowId}`)) {
            fs.mkdirSync(`${stagingDir}/${download.workflowId}`, {
              recursive: true,
            });
          }

          const usenetFiles = fs.readdirSync(msg.destDirectory);
          logger.debug("Usenet files:", usenetFiles);

          const mediaFilenames = usenetFiles.filter((filename) => {
            const extension = filename.split(".").pop();
            return MEDIA_EXTENSIONS.includes(extension!);
          });
          logger.info("Media filenames:", mediaFilenames);

          if (!mediaFilenames || mediaFilenames.length === 0) {
            await this.failDownload(nzbId, "failed");

            return;
          } else if (mediaFilenames?.length > 0) {
            logger.warn(
              "Multiple media filenames found, this should not happen",
              mediaFilenames,
            );
          }

          const mediaFilename = mediaFilenames[0];
          logger.info("Media filename:", mediaFilename);

          const originalExtension = mediaFilename.split(".").pop();

          logger.info("Moving asset to staging directory:");
          logger.debug(`\t   Original: ${msg.destDirectory}/${mediaFilename}`);
          logger.debug(
            `\tDestination: ${stagingDir}/${download.workflowId}/original.${originalExtension}`,
          );

          fs.renameSync(
            `${msg.destDirectory}/${mediaFilename}`,
            `${stagingDir}/${download.workflowId}/original.${originalExtension}`,
          );

          logger.debug(
            `Publishing "media.trigger" message for workflow ${download.workflowId}`,
          );

          await this.amqpConnection.publish(
            "media.trigger",
            `jobType.extractMetadata`,
            {
              workflowId: download.workflowId,
              mediaType: "original",
              mediaExtension: originalExtension,
            },
            {
              persistent: true,
            },
          );

          await this.deleteNzbHistory(nzbId);
        } else if (msg.status.startsWith("FAILURE")) {
          await this.failDownload(nzbId, "failed");
        }
      }
    } catch (e) {
      logger.error(`Error processing download update message: ${e.message}`, e);

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

      const updatedDownload = await this.updateDownloadStatus(nzbId, downloadUpdate, "download_failed");

      if (updatedDownload && updatedDownload.workflowId) {
        await mediaApi.updateMediaAssetWorkflow(updatedDownload.workflowId, {
          status: "failed",
          finishedTime: now.toISOString(),
        });
      } else {
        logger.warn(`Download for NZB ${nzbId} is not associated with a workflow, skipping update`);
      }

      if (cleanupNzb) {
        await this.deleteNzbHistory(nzbId);
      }
    } catch (e) {
      logger.error(`Error updating download status: ${e.message}`, e);
    }
  }
}
