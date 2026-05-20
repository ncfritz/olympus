import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { MediaAssetWorkflow } from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import fs from "fs";
import moment from "moment";
import mediaApi from "../../api/mediaApi";
import metadataApi from "../../api/metadataApi";
import { IngestError } from "../../error/ingestError";
import { type TranscodeMediaMessage } from "../../types/messages";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import {
  createStep,
  updateStepProgress,
  updateStepStatus,
} from "../../workflow/media/reporter";
import { MediaWorkflow } from "../../workflow/media/workflow";

@Injectable()
export class TranscodeMediaHandler {
  private libraryFilesToUpload: Record<string, string>;
  private cdnFilesToUpload: Record<string, string>;
  private transcodeJob: any;
  private transcodeMetadata: any;

  constructor(private readonly amqpConnection: AmqpConnection) {
    this.libraryFilesToUpload = {};
    this.cdnFilesToUpload = {};
  }

  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.transcode.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.transcode`,
    queueOptions: {
      channel: "transcodeMediaChannel",
      arguments: {
        "x-consumer-timeout": 9 * 60 * 60 * 1000, // 9h in ms
      },
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: TranscodeMediaMessage, amqMsg: ConsumeMessage) {
    const workflow = new MediaWorkflow(
      msg.workflowId,
      msg.mediaExtension,
      "transcode",
    );

    try {
      const workflowInstance = await mediaApi.describeMediaAssetWorkflow(
        workflow.workflowId,
      );

      logger.info("Starting transcode workflow: init()");
      await workflow.init();

      logger.info("Fetching original metadata...");
      await workflow.downloadFile("original.json", "original.json");
      this.cdnFilesToUpload["original.json"] =
        `/Dionysus/metadata/${workflowInstance.type}/${workflowInstance.mediaId}/original_metadata.json`;

      logger.info("Downloading transcode job config...");
      this.transcodeJob = await workflow.downloadFile(
        "transcodeJob.json",
        "transcodeJob.json",
      );

      logger.info("Downloading transcode metadata config...");
      this.transcodeMetadata = await workflow.downloadFile(
        "transcodeMetadata.json",
        "transcodeMetadata.json",
      );

      logger.info("Running transcode...");
      await this.transcode(workflow, workflowInstance);

      logger.info("Extracting new metadata...");
      await workflow.extractMetadata("extract_new_metadata", "metadata", false);
      this.cdnFilesToUpload[`metadata.json`] =
        `/Dionysus/metadata/${workflowInstance.type}/${workflowInstance.mediaId}/metadata.json`;

      if (process.env.DIONYSUS_SKIP_SSH_UPLOAD !== "true") {
        await workflow.upload(
          {
            "metadata.json": `/Dionysus/workflow/${workflowInstance.id}/metadata.json`,
          },
          {
            host: process.env.DIONYSUS_CDN_SSH_HOST,
            port: 22,
            username: process.env.DIONYSUS_CDN_SSH_USERNAME!,
            password: process.env.DIONYSUS_CDN_SSH_PASSWORD!,
          },
          undefined,
        );
      } else {
        fs.copyFileSync(
          `${workflow.stagingDir}/metadata.json`,
          `${workflow.localDir}/metadata.json`,
        );
      }

      logger.info("Adding transcoded asset to library...");
      await this.uploadAssets(workflow, workflowInstance);

      logger.info("Triggering cleanup job...");
      await this.amqpConnection.publish("media.trigger", "jobType.cleanup", {
        workflowId: workflow.workflowId,
      });
    } catch (e) {
      logger.error(`Transcode workflow failed: ${e}`);
    } finally {
      try {
        //fs.rmSync(workflow.stagingDir, { recursive: true, force: true });
      } catch (e) {
        logger.error(
          `Failed to remove temp directory ${workflow.stagingDir}: ${e}`,
        );
      }
    }
  }

  private async transcode(
    workflow: MediaWorkflow,
    workflowInstance: MediaAssetWorkflow,
  ) {
    const step = await createStep(workflow.workflowId, "transcode");

    try {
      logger.info("Creating local transcode job definition...");
      this.transcodeJob[0].Job.Source.Path = `${workflow.stagingDir}/original.${this.transcodeMetadata.mediaExtension}`;
      this.transcodeJob[0].Job.Destination.File = `${workflow.stagingDir}/transcoded.mp4`;
      fs.writeFileSync(
        `${workflow.stagingDir}/localJob.json`,
        JSON.stringify(this.transcodeJob, null, 2),
      );

      logger.info("Determining library path...");
      let unsanitizedFileName = "";
      let unsanitizedPath = "";

      if (workflowInstance.type === "movie") {
        const movie = await metadataApi.describeMovie(workflowInstance.mediaId);
        const year = movie.releaseDate
          ? moment(movie.releaseDate).year()
          : undefined;
        unsanitizedFileName = `${movie.title}${year ? ` (${year}).mp4` : ""}`;

        if (/^[a-z]/i.test(unsanitizedFileName)) {
          unsanitizedPath = `/Movies/${unsanitizedFileName[0].toUpperCase()}`;
        } else {
          unsanitizedPath = "/Movies/0-9";
        }
      } else if (workflowInstance.type === "tv_episode") {
        const episode = await metadataApi.getTvEpisodeById(
          workflowInstance.mediaId,
        );
        const year = episode.series.firstAirDate
          ? moment(episode.series.firstAirDate).year()
          : undefined;
        unsanitizedFileName = `${episode.series.name}${
          year ? ` (${year})` : ""
        } - s${episode.seasonNumber
          .toString()
          .padStart(2, "0")}e${episode.episodeNumber
          .toString()
          .padStart(2, "0")} - ${episode.name}.mp4`;
        unsanitizedPath = `/TV Series/${
          episode.series.name
        }/Season ${episode.seasonNumber.toString().padStart(2, "0")}`;
      } else {
        throw new IngestError(
          `Unsupported media type: ${workflowInstance.type}`,
        );
      }

      const sanitizedFilename = unsanitizedFileName
        .replace(/\//g, " -")
        .replace(/\s+/g, " ")
        .trim();
      const sanitizedPath = unsanitizedPath.trim();

      logger.info(`\tFilename: ${sanitizedFilename}`);
      logger.info(`\tPath: ${sanitizedPath}`);

      logger.info("Downloading source asset...");
      await workflow.fetchSource(step, this.transcodeMetadata.mediaExtension);
      await workflow.transcode(
        `${workflow.stagingDir}/localJob.json`,
        async (progress) => {
          try {
            await updateStepProgress(workflow.workflowId, step.id, progress);
          } catch (e) {
            logger.error("Unable to update transcode progress...");
          }
        },
      );

      await updateStepStatus(workflow.workflowId, step.id, "success");

      this.libraryFilesToUpload["transcoded.mp4"] =
        `${sanitizedPath}/${sanitizedFilename}`;
    } catch (e) {
      console.log(e);
      await updateStepStatus(workflow.workflowId, step.id, "failed");
    }
  }

  private async uploadAssets(
    workflow: MediaWorkflow,
    workflowInstance: MediaAssetWorkflow,
  ) {
    const step = await createStep(workflow.workflowId, "upload");

    try {
      const newMetadata = JSON.parse(
        fs.readFileSync(`${workflow.stagingDir}/metadata.json`, "utf8"),
      );
      const videoStream = newMetadata.streams.find(
        (stream: any) => stream.codec_type === "video",
      );

      const assetSha = await workflow.calculateOutputSha();

      if (process.env.DIONYSUS_SKIP_SSH_UPLOAD === "true") {
        logger.error("Skipping SSH upload");
      } else {
        logger.info("Uploading assets to CDN and library servers");
        console.log(this.cdnFilesToUpload);
        console.log(this.libraryFilesToUpload);
        await workflow.upload(
          this.libraryFilesToUpload,
          {
            host: process.env.DIONYSUS_LIBRARY_SSH_HOST!,
            port: 22,
            username: process.env.DIONYSUS_LIBRARY_SSH_USERNAME!,
            password: process.env.DIONYSUS_LIBRARY_SSH_PASSWORD!,
          },
          async (progress, bytesTransferred) => {
            await updateStepProgress(workflow.workflowId, step.id, progress);
          },
        );
        await workflow.upload(
          this.cdnFilesToUpload,
          {
            host: process.env.DIONYSUS_CDN_SSH_HOST!,
            port: 22,
            username: process.env.DIONYSUS_CDN_SSH_USERNAME!,
            password: process.env.DIONYSUS_CDN_SSH_PASSWORD!,
          },
          undefined,
        );

        await mediaApi.createMediaAsset({
          type: workflowInstance.type,
          mediaId: workflowInstance.mediaId,
          assetSha: assetSha,
          originalSizeBytes: this.transcodeMetadata.size,
          newSizeBytes: fs.statSync(`${workflow.stagingDir}/transcoded.mp4`)
            .size,
          width: videoStream.width,
          height: videoStream.height,
          durationMs: Math.ceil(videoStream.duration * 1000),
          filePath: "/Dionysus/media/transcoded.mp4",
        });
      }

      await updateStepStatus(workflow.workflowId, step.id, "success");
    } catch (e) {
      await updateStepStatus(workflow.workflowId, step.id, "failed");
      throw e;
    }
  }
}
