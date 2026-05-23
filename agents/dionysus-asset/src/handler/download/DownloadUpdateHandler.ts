import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  PartialMediaAssetDownload,
  SearchResultStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ConsumeMessage } from "amqplib";
import axios from "axios";
import fs from "fs";
import moment from "moment";
import mediaApi from "../../api/mediaApi";
import {
  DOWNLOAD_PREFIX,
  DOWNLOAD_UPDATE_EXCHANGE,
  UPDATE_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";

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
export class DownloadUpdateHandler {
  private readonly nzbGetUrl: string;
  private readonly nzbGetUsername: string;
  private readonly nzbGetPassword: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    protected readonly configService: ConfigService,
  ) {
    const nzbGetHost = this.configService.get<string>(
      "NZBGET_HOST",
      "localhost",
    );
    const nzbGetPort = this.configService.get<number>("NZBGET_PORT", 6789);

    this.nzbGetUrl = `http://${nzbGetHost}:${nzbGetPort}/jsonrpc`;
    this.nzbGetUsername = this.configService.get<string>("NZBGET_USERNAME")!;
    this.nzbGetPassword = this.configService.get<string>("NZBGET_PASSWORD")!;
  }

  @RabbitSubscribe({
    exchange: DOWNLOAD_UPDATE_EXCHANGE,
    queue: `${DOWNLOAD_PREFIX}.${UPDATE_SUFFIX}`,
    routingKey: `${UPDATE_SUFFIX}.*`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: any, amqMsg: ConsumeMessage) {
    const ts = msg.ts;
    const nzbId = parseInt(msg.nzbId);
    const stagingDir = process.env.STAGING_DIRECTORY!;

    try {
      if (process.env.PERSIST_EVENTS === "true") {
        const filePath = `${process.env.EVENTS_DIRECTORY}/${ts}.json`;
        fs.writeFileSync(filePath, JSON.stringify(msg, null, 2));
      }

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
          msg.event === "NZB_DELETED0" &&
          msg.deleteStatus === "COPY"
        ) {
          await this.updateDownloadStatus(
            nzbId,
            {
              status: "cancelled",
              startedTime: moment.utc().toISOString(),
              finishedTime: moment.utc().toISOString(),
            },
            "download_failed",
          );
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
            await this.updateDownloadStatus(
              nzbId,
              {
                status: "failed",
                finishedTime: moment.utc().toISOString(),
              },
              "download_failed",
            );
            await this.deleteNzbHistory(nzbId);

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
          await this.updateDownloadStatus(
            nzbId,
            {
              status: "failed",
              finishedTime: moment.utc().toISOString(),
            },
            "download_failed",
          );
          await this.deleteNzbHistory(nzbId);
        }
      }
    } catch (e) {
      logger.error(`Error processing download update message: ${e.message}`, e);

      await this.updateDownloadStatus(
        nzbId,
        {
          status: "failed",
          finishedTime: moment.utc().toISOString(),
        },
        "download_failed",
      );
      await this.deleteNzbHistory(nzbId);
    }
  }

  private async updateDownloadStatus(
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

  private async deleteNzbHistory(nzbId: number) {
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
