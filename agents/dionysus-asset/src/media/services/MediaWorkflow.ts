import type {
  MediaAssetWorkflowStep,
  MediaAssetWorkflowStepType,
} from "@ncfritz/olympus-sdk/dionysus";
import axios from "axios";
import Ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import moment from "moment";
import { finished } from "node:stream/promises";
import path from "path";
import progress_stream from "progress-stream";
import type sftp from "ssh2-sftp-client";
import { Logger } from "@nestjs/common";
import type { MediaConfigType } from "../../config/configuration";
import { sha256File } from "../../tools/sha256";
import { withSftp } from "../../tools/sftp";
import { IngestError } from "../../tools/errors/IngestError";
import type { Handbrake } from "../../tools/handbrake/Handbrake";
import type { MediaReporter } from "./MediaReporter";

const logger = new Logger("MediaWorkflow");

/** What a media workflow works with. */
export type MediaWorkflowDeps = {
  config: MediaConfigType;
  reporter: MediaReporter;
  handbrake: Handbrake;
};

/**
 * One media workflow's files: its staging directory (fetched from the CDN
 * or a local directory), FFmpeg and HandBrake runs on them, and uploads.
 */
export class MediaWorkflow {
  private readonly config: MediaConfigType;
  private readonly reporter: MediaReporter;
  private readonly handbrake: Handbrake;

  readonly workflowId: string;
  readonly mediaExtension: string;
  readonly localDir: string;
  readonly stagingDir: string;
  readonly sourceFile: string;
  readonly jobFile: string;
  readonly cdnUrl: string;

  constructor(
    workflowId: string,
    mediaExtension: string,
    extraPath: string | undefined,
    deps: MediaWorkflowDeps,
  ) {
    this.config = deps.config;
    this.reporter = deps.reporter;
    this.handbrake = deps.handbrake;
    this.workflowId = workflowId;
    this.mediaExtension = mediaExtension;

    this.localDir = `${this.config.localDirectory}/${this.workflowId}`;
    this.stagingDir = `${this.config.stagingDirectory}/${this.workflowId}${
      extraPath ? `/${extraPath}` : ""
    }`;
    this.sourceFile = `${this.stagingDir}/original.${this.mediaExtension}`;
    this.jobFile = `${this.stagingDir}/transcodeJob.json`;
    this.cdnUrl = `${this.config.cdnBaseUrl}/workflow/${this.workflowId}`;
  }

  async init() {
    logger.log(`Running workflow step "init()`);

    if (!fs.existsSync(`${this.stagingDir}`)) {
      logger.debug(`Creating staging directory: ${this.stagingDir}`);

      fs.mkdirSync(`${this.stagingDir}`, {
        recursive: true,
      });
    }
  }

  async downloadAsset(
    path: string,
    destinationPath: string,
    onProgress?: (progress: number) => Promise<void>,
    progressInterval = 5000,
  ) {
    logger.log(`Running workflow step "downloadAsset()`);
    logger.debug(`path: ${path}`);
    logger.debug(`destinationPath: ${destinationPath}`);

    if (!path.startsWith("/")) {
      path = `/${path}`;
    }

    if (!destinationPath.startsWith("/")) {
      destinationPath = `/${destinationPath}`;
    }

    if (this.config.deploymentMode === "local") {
      logger.debug(
        `Copying asset from local storage: ${this.localDir}${path} to ${this.stagingDir}${destinationPath}`,
      );

      fs.copyFileSync(
        `${this.localDir}${path}`,
        `${this.stagingDir}${destinationPath}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      logger.debug("Downloading asset from CDN: " + `${this.cdnUrl}${path}`);

      let lastProgressUpdate = 0;
      const assetResponse = await axios.get(`${this.cdnUrl}${path}`, {
        responseType: "stream",
        onDownloadProgress: (e) => {
          if (!e.total) {
            return;
          }

          const progress = Math.round((e.loaded * 100) / e.total);
          const now = moment().utc().valueOf();

          if (now - lastProgressUpdate > progressInterval) {
            if (onProgress) {
              (async () => {
                await onProgress(progress);
              })();
            } else {
              logger.debug(`Progress: ${progress}%`);
            }

            lastProgressUpdate = now;
          }
        },
      });
      const writer = fs.createWriteStream(
        `${this.stagingDir}${destinationPath}`,
      );
      assetResponse.data.pipe(writer);
      await finished(writer);
    }

    logger.debug("Asset fetched...");
  }

  /**
   * Fetches a JSON file of the workflow into staging; resolves to its
   * content (parsed from the CDN, raw text in local mode).
   */
  async downloadFile<T = unknown>(
    path: string,
    destinationPath: string,
  ): Promise<T> {
    logger.log(`Running workflow step "downloadFile()`);
    logger.debug(`path: ${path}`);
    logger.debug(`destinationPath: ${destinationPath}`);

    if (!path.startsWith("/")) {
      path = `/${path}`;
    }

    if (!destinationPath.startsWith("/")) {
      destinationPath = `/${destinationPath}`;
    }

    if (this.config.deploymentMode === "local") {
      logger.debug(
        `Copying asset from local storage: ${this.localDir}${path} to ${this.stagingDir}${destinationPath}`,
      );

      fs.copyFileSync(
        `${this.localDir}${path}`,
        `${this.stagingDir}${destinationPath}`,
      );

      return fs.readFileSync(
        `${this.stagingDir}${destinationPath}`,
        "utf-8",
      ) as T;
    } else {
      const sourceUrl = `${this.cdnUrl}${path}`;
      const destinationFile = `${this.stagingDir}${destinationPath}`;

      logger.log(`Downloading ${path} file from CDN:`);
      logger.debug(`Source URL: ${sourceUrl}`);
      logger.debug(`Destination file: ${destinationFile}`);

      const response = await axios.get<T>(sourceUrl);
      fs.writeFileSync(destinationFile, JSON.stringify(response.data, null, 2));

      return response.data;
    }
  }

  async extractSrt(subtitleIndex: number) {
    logger.log(`Running workflow step "extractSrt()`);
    logger.debug(`subtitleIndex: ${subtitleIndex}`);

    await new Promise<void>((resolve, reject) => {
      const command = Ffmpeg(this.sourceFile);
      command.addOption(`-map 0:s:${subtitleIndex}`);
      command.on("error", async (err) => {
        logger.error(`An error occurred: ${err.message}`);
        reject(new IngestError("Unable to extract SRT from asset:", err));
      });
      command.on("end", async () => {
        resolve();
      });
      command.saveToFile(`${this.stagingDir}/subtitle.srt`);
    });
  }

  async transcode(
    jobFile: string,
    onProgress: (progress: number) => Promise<void>,
  ) {
    logger.log(`Running workflow step "transcode()`);
    logger.debug(`jobFile: ${jobFile}`);

    await new Promise<void>((resolve, reject) => {
      let lastProgressUpdate = 0;

      logger.debug(`Transcoding job file: ${jobFile}`);

      this.handbrake
        .spawn({ "queue-import-file": jobFile })
        .on("error", (err) => {
          reject(
            new IngestError(
              "An error occurred transcoding the file: " + err.message,
            ),
          );
        })
        .on("progress", (progress) => {
          const now = moment().utc().valueOf();

          if (progress.percentComplete && now - lastProgressUpdate > 3000) {
            if (onProgress) {
              (async () => {
                await onProgress(progress.percentComplete);
              })();
            } else {
              logger.debug(`Progress: ${progress.percentComplete}%`);
            }

            lastProgressUpdate = now;
          }
        })
        .on("complete", (_result) => {
          resolve();
        })
        .run();
    });
  }

  async fetchSource(step: MediaAssetWorkflowStep, assetExtension: string) {
    logger.log(`Running workflow step "fetchSource()`);
    logger.debug(`workflowStepId: ${step.id}`);

    const subStep = await this.reporter.createSubStep(
      this.workflowId,
      step.id,
      "transfer_source",
    );

    try {
      logger.log(
        `Downloading transcodeJob.json for workflow ${this.workflowId}`,
      );
      await this.downloadFile(`transcodeJob.json`, "transcodeJob.json");

      logger.log(`Downloading original asset for workflow ${this.workflowId}`);
      await this.downloadAsset(
        `original.${assetExtension}`,
        `original.${assetExtension}`,
        async (p) => {
          await this.reporter.updateStepProgress(
            this.workflowId,
            subStep.id,
            p,
          );
        },
      );

      await this.reporter.updateStepStatus(
        this.workflowId,
        subStep.id,
        "success",
      );
    } catch (e) {
      logger.error(`An error occurred: ${e.message}`);
      await this.reporter.updateStepStatus(
        this.workflowId,
        subStep.id,
        "failed",
      );
      throw e;
    }
  }

  async upload(
    files: Record<string, string>,
    connection: sftp.ConnectOptions,
    onProgress?: (progress: number, bytesTransferred: number) => Promise<void>,
  ): Promise<void> {
    logger.log(`Running workflow step "upload()`);

    try {
      const totalSize = Object.keys(files).reduce((acc, file) => {
        if (!file.startsWith("/")) {
          file = `/${file}`;
        }

        logger.debug(`Processing ${file}`);
        return acc + fs.statSync(`${this.stagingDir}${file}`).size;
      }, 0);

      logger.log(`Total size to upload: ${totalSize} bytes`);
      let lastUpdateTime = 0;

      if (this.config.skipCdnDownload) {
        for (let [file, destination] of Object.entries(files)) {
          if (!file.startsWith("/")) {
            file = `/${file}`;
          }

          if (!destination.startsWith("/")) {
            destination = `/${destination}`;
          }

          const destinationPath = path.dirname(destination);

          if (!fs.existsSync(`${this.localDir}${destinationPath}`)) {
            fs.mkdirSync(`${this.localDir}${destinationPath}`, {
              recursive: true,
            });
          }

          fs.copyFileSync(
            `${this.stagingDir}${file}`,
            `${this.localDir}${destination}`,
          );
        }
      } else {
        logger.debug("Connecting SSH...");
        await withSftp(connection, async (client) => {
          for (let [file, destination] of Object.entries(files)) {
            if (!file.startsWith("/")) {
              file = `/${file}`;
            }

            const sourceFile = `${this.stagingDir}${file}`;

            if (!destination.startsWith("/")) {
              destination = `/${destination}`;
            }

            logger.debug(`Uploading ${sourceFile}`);
            const stat = fs.statSync(sourceFile);
            const pStream = progress_stream({
              length: stat.size,
              time: 500,
            });
            pStream.on(
              "progress",
              (p: { transferred: number; percentage: number }) => {
                const now = moment().utc().valueOf();

                if (now - lastUpdateTime > 5000) {
                  const progress = (p.transferred / totalSize) * 100;

                  logger.debug(
                    `Transferred ${p.transferred} bytes of ${totalSize} - ${progress}%`,
                  );

                  if (onProgress) {
                    (async () => {
                      await onProgress(progress, p.transferred);
                    })();
                  }

                  lastUpdateTime = now;
                }
              },
            );

            const remoteDir = destination.substring(
              0,
              destination.lastIndexOf("/"),
            );
            const stream = fs.createReadStream(sourceFile).pipe(pStream);

            logger.log(`Uploading ${sourceFile} to ${destination}...`);
            await client.mkdir(remoteDir, true);
            await client.put(stream, destination);
          }
        });
      }
    } catch (e) {
      logger.error(`Asset upload failed: ${e.message}`);
      throw new IngestError("Unable to upload assets:", e);
    }
  }

  async extractMetadata(
    stepType: MediaAssetWorkflowStepType,
    metadataType: "original" | "metadata",
    extractHandbrakeMetadata: boolean,
  ) {
    logger.log(`Running workflow step "extractMetadata(${metadataType})`);

    const step = await this.reporter.createStep(this.workflowId, stepType);

    try {
      const sourceFile =
        metadataType === "original"
          ? `${this.stagingDir}/${metadataType}.${this.mediaExtension}`
          : `${this.stagingDir}/transcoded.mp4`;
      const ffprobeMetadata = `${this.stagingDir}/${metadataType}.json`;

      await new Promise<void>((resolve, reject) => {
        Ffmpeg.ffprobe(sourceFile, async (err, data) => {
          if (err) {
            reject(new IngestError("FFProbe failed with error: ", err));
          } else if (!data) {
            reject(new IngestError("FFProbe did not return any data"));
          } else {
            fs.writeFileSync(ffprobeMetadata, JSON.stringify(data, null, 2));
            resolve();
          }
        });
      });

      if (extractHandbrakeMetadata) {
        const handbrakeMetadata = `${this.stagingDir}/handbrakeMetadata.json`;

        await new Promise<void>((resolve, reject) => {
          this.handbrake
            .spawn({ input: sourceFile, scan: true, json: true })
            .on("error", (err) => {
              reject(
                new IngestError(
                  "An error occurred extracting Handbrake metadata: " +
                    err.message,
                ),
              );
            })
            .on("output", (result) => {
              if (result.indexOf("JSON Title Set: ") <= -1) {
                return;
              }

              const output = JSON.parse(
                result.substring(
                  result.indexOf("JSON Title Set: ") +
                    "JSON Title Set: ".length,
                ),
              );

              fs.writeFileSync(
                handbrakeMetadata,
                JSON.stringify(output, null, 2),
              );
            })
            .on("complete", (_result) => {
              resolve();
            })
            .run();
        });
      }

      await this.reporter.updateStepStatus(this.workflowId, step.id, "success");
    } catch (e) {
      await this.reporter.updateStepStatus(this.workflowId, step.id, "failed");
      throw e;
    }
  }

  async calculateOutputSha(): Promise<string> {
    logger.log(`Running workflow step "calculateOutputSha()`);
    logger.log("Generating SHA-256 of asset...");
    const digest = await sha256File(`${this.stagingDir}/transcoded.mp4`);
    logger.debug(`Output SHA: ${digest}`);
    return digest;
  }
}
