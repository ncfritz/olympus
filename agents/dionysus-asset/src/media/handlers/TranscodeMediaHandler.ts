import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { publishMessage } from "@ncfritz/olympus-messages";
import type { DecoratedMediaAssetWorkflow } from "@ncfritz/olympus-sdk/dionysus";
import { Inject, Injectable, Logger } from "@nestjs/common";
import fs from "fs";
import { MediaApi } from "../../api/MediaApi";
import { MetadataApi } from "../../api/MetadataApi";
import { mediaConfig } from "../../config/configuration";
import type { MediaConfigType } from "../../config/configuration";
import {
  MEDIA_ROUTES,
  MEDIA_SUBSCRIPTIONS,
  type TranscodeMediaMessage,
} from "../../messaging";
import { IngestError } from "../../tools/errors/IngestError";
import type { HandbrakeJobFile } from "../../tools/handbrake/jobFile";
import {
  episodeLibraryPath,
  movieLibraryPath,
  type LibraryPath,
} from "../planning/libraryPath";
import type {
  ProbedMetadata,
  TranscodeMetadata,
} from "../planning/transcodeMetadata";
import { MediaReporter } from "../services/MediaReporter";
import type { MediaWorkflow } from "../services/MediaWorkflow";
import { MediaWorkflows } from "../services/MediaWorkflows";

/** One transcode's state. */
type TranscodeRun = {
  /** Staging file → library path. */
  libraryFilesToUpload: Record<string, string>;
  /** Staging file → CDN path. */
  cdnFilesToUpload: Record<string, string>;
  /** The HandBrake job (transcodeJob.json). */
  transcodeJob?: HandbrakeJobFile;
  /** transcodeMetadata.json: tracks, extension, size, ... */
  transcodeMetadata?: TranscodeMetadata;
};

/**
 * Transcodes a media workflow's original with its approved HandBrake job,
 * extracts the result's metadata, uploads the file to the library and the
 * metadata to the CDN, records the media asset and asks for cleanup.
 */
@Injectable()
export class TranscodeMediaHandler {
  private readonly logger = new Logger(TranscodeMediaHandler.name);

  constructor(
    @Inject(mediaConfig.KEY) private readonly media: MediaConfigType,
    private readonly amqpConnection: AmqpConnection,
    private readonly mediaApi: MediaApi,
    private readonly metadataApi: MetadataApi,
    private readonly reporter: MediaReporter,
    private readonly workflows: MediaWorkflows,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.transcode)
  public async handle(msg: TranscodeMediaMessage): Promise<void> {
    const run: TranscodeRun = {
      libraryFilesToUpload: {},
      cdnFilesToUpload: {},
    };
    this.logger.debug("TranscodeMediaHandler");
    this.logger.debug(msg);

    const workflow = this.workflows.open(
      msg.workflowId,
      msg.mediaExtension!,
      "transcode",
    );

    try {
      const workflowInstance = await this.mediaApi.describeMediaAssetWorkflow(
        workflow.workflowId,
      );

      this.logger.log("Starting transcode workflow: init()");
      await workflow.init();

      this.logger.log("Fetching original metadata...");
      await workflow.downloadFile("original.json", "original.json");
      run.cdnFilesToUpload["original.json"] =
        `/Dionysus/metadata/${workflowInstance.type}/${workflowInstance.mediaId}/original_metadata.json`;

      this.logger.log("Downloading transcode job config...");
      run.transcodeJob = await workflow.downloadFile<HandbrakeJobFile>(
        "transcodeJob.json",
        "transcodeJob.json",
      );

      this.logger.log("Downloading transcode metadata config...");
      run.transcodeMetadata = await workflow.downloadFile<TranscodeMetadata>(
        "transcodeMetadata.json",
        "transcodeMetadata.json",
      );

      this.logger.log("Running transcode...");
      await this.transcode(workflow, workflowInstance, run);

      this.logger.log("Extracting new metadata...");
      await workflow.extractMetadata("extract_new_metadata", "metadata", false);
      run.cdnFilesToUpload[`metadata.json`] =
        `/Dionysus/metadata/${workflowInstance.type}/${workflowInstance.mediaId}/metadata.json`;

      if (!this.media.skipSshUpload) {
        await workflow.upload(
          {
            "metadata.json": `/Dionysus/workflow/${workflowInstance.id}/metadata.json`,
          },
          {
            host: this.media.cdn.host,
            port: 22,
            username: this.media.cdn.username!,
            password: this.media.cdn.password!,
          },
          undefined,
        );
      } else {
        fs.copyFileSync(
          `${workflow.stagingDir}/metadata.json`,
          `${workflow.localDir}/metadata.json`,
        );
      }

      this.logger.log("Adding transcoded asset to library...");
      await this.uploadAssets(workflow, workflowInstance, run);

      this.logger.log("Triggering cleanup job...");
      await publishMessage(this.amqpConnection, MEDIA_ROUTES.cleanup, {
        workflowId: workflow.workflowId,
        mediaExtension: run.transcodeMetadata!.mediaExtension,
      });
    } catch (e) {
      this.logger.error(`Transcode workflow failed: ${e}`);
    } finally {
      try {
        if (this.media.transcodeCleanup) {
          fs.rmSync(workflow.stagingDir, { recursive: true, force: true });
        }
      } catch (e) {
        this.logger.error(
          `Failed to remove temp directory ${workflow.stagingDir}: ${e}`,
        );
      }
    }
  }

  private async transcode(
    workflow: MediaWorkflow,
    workflowInstance: DecoratedMediaAssetWorkflow,
    run: TranscodeRun,
  ) {
    const step = await this.reporter.createStep(
      workflow.workflowId,
      "transcode",
    );

    try {
      const transcodeJob = run.transcodeJob!;
      const transcodeMetadata = run.transcodeMetadata!;

      this.logger.log("Creating local transcode job definition...");
      transcodeJob[0].Job.Source.Path = `${workflow.stagingDir}/original.${transcodeMetadata.mediaExtension}`;
      transcodeJob[0].Job.Destination.File = `${workflow.stagingDir}/transcoded.mp4`;
      fs.writeFileSync(
        `${workflow.stagingDir}/localJob.json`,
        JSON.stringify(transcodeJob, null, 2),
      );

      this.logger.log("Determining library path...");
      const library = await this.libraryPath(workflowInstance);

      this.logger.log(`\tFilename: ${library.fileName}`);
      this.logger.log(`\tPath: ${library.path}`);

      this.logger.log("Downloading source asset...");
      await workflow.fetchSource(step, transcodeMetadata.mediaExtension);
      await workflow.transcode(
        `${workflow.stagingDir}/localJob.json`,
        async (progress) => {
          try {
            await this.reporter.updateStepProgress(
              workflow.workflowId,
              step.id,
              progress,
            );
          } catch {
            this.logger.error("Unable to update transcode progress...");
          }
        },
      );

      await this.reporter.updateStepStatus(
        workflow.workflowId,
        step.id,
        "success",
      );

      run.libraryFilesToUpload["transcoded.mp4"] =
        `${library.path}/${library.fileName}`;
    } catch (e) {
      this.logger.error(e instanceof Error ? e.stack : String(e));
      await this.reporter.updateStepStatus(
        workflow.workflowId,
        step.id,
        "failed",
      );
      throw e;
    }
  }

  /** The library directory and file name of the workflow's media. */
  private async libraryPath(
    workflowInstance: DecoratedMediaAssetWorkflow,
  ): Promise<LibraryPath> {
    if (workflowInstance.type === "movie") {
      return movieLibraryPath(
        await this.metadataApi.describeMovie(workflowInstance.mediaId),
      );
    }

    if (workflowInstance.type === "tv_episode") {
      const episode = await this.metadataApi.getTvEpisodeById(
        workflowInstance.mediaId,
      );
      // The series can be missing (no referential integrity yet).
      if (!episode.series) {
        throw new IngestError(
          `No series for TV episode ${workflowInstance.mediaId}`,
        );
      }

      return episodeLibraryPath(episode.series, episode);
    }

    throw new IngestError(`Unsupported media type: ${workflowInstance.type}`);
  }

  private async uploadAssets(
    workflow: MediaWorkflow,
    workflowInstance: DecoratedMediaAssetWorkflow,
    run: TranscodeRun,
  ) {
    const step = await this.reporter.createStep(workflow.workflowId, "upload");

    try {
      const newMetadata = JSON.parse(
        fs.readFileSync(`${workflow.stagingDir}/metadata.json`, "utf8"),
      ) as ProbedMetadata;
      const videoStream = newMetadata.streams.find(
        (stream) => stream.codec_type === "video",
      )!;

      const assetSha = await workflow.calculateOutputSha();

      if (this.media.skipSshUpload) {
        this.logger.error("Skipping SSH upload");
      } else {
        this.logger.log("Uploading assets to CDN and library servers");
        await workflow.upload(
          run.libraryFilesToUpload,
          {
            host: this.media.library.host,
            port: 22,
            username: this.media.library.username!,
            password: this.media.library.password!,
          },
          async (progress, _bytesTransferred) => {
            await this.reporter.updateStepProgress(
              workflow.workflowId,
              step.id,
              progress,
            );
          },
        );
        await workflow.upload(
          run.cdnFilesToUpload,
          {
            host: this.media.cdn.host,
            port: 22,
            username: this.media.cdn.username!,
            password: this.media.cdn.password!,
          },
          undefined,
        );

        await this.mediaApi.createMediaAsset({
          type: workflowInstance.type,
          mediaId: workflowInstance.mediaId,
          assetSha: assetSha,
          originalSizeBytes: run.transcodeMetadata!.size,
          newSizeBytes: fs.statSync(`${workflow.stagingDir}/transcoded.mp4`)
            .size,
          width: videoStream.width!,
          height: videoStream.height!,
          durationMs: Math.ceil(Number(videoStream.duration) * 1000),
          filePath: "/Dionysus/media/transcoded.mp4",
        });
      }

      await this.reporter.updateStepStatus(
        workflow.workflowId,
        step.id,
        "success",
      );
    } catch (e) {
      await this.reporter.updateStepStatus(
        workflow.workflowId,
        step.id,
        "failed",
      );
      throw e;
    }
  }
}
