import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MediaAssetWorkflowStep,
  MediaAssetWorkflowSubStepType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Inject, Injectable, Logger } from "@nestjs/common";
import fs from "fs";
import { parseFile } from "subparse";
import { MediaApi } from "@ncfritz/olympus-client";
import { mediaConfig } from "../../config/configuration";
import type { MediaConfigType } from "../../config/configuration";
import {
  MEDIA_SUBSCRIPTIONS,
  type MediaWorkflowFileMessage,
} from "../../messaging";
import { MediaReporter } from "../services/MediaReporter";
import type { MediaWorkflow } from "../services/MediaWorkflow";
import { MediaWorkflows } from "../services/MediaWorkflows";
import type { HandbrakeJobFile } from "../../tools/handbrake/jobFile";
import {
  SAMPLE_COUNT,
  planSample,
  sampleHeight,
  sampleStartTimes,
  type SubtitleEntry,
} from "../planning/planSamples";
import type { TranscodeMetadata } from "../planning/transcodeMetadata";

/**
 * Verifies a transcode configuration that needs it (subtitles, or flagged):
 * transcodes six 90-second samples, spread over the subtitles or the
 * duration, for review on the CDN; otherwise verifies it right away.
 */
@Injectable()
export class VerifyTranscodeConfigurationHandler {
  private readonly logger = new Logger(
    VerifyTranscodeConfigurationHandler.name,
  );

  constructor(
    @Inject(mediaConfig.KEY) private readonly media: MediaConfigType,
    private readonly mediaApi: MediaApi,
    private readonly reporter: MediaReporter,
    private readonly workflows: MediaWorkflows,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.verifyTranscodeConfiguration)
  public async handle(msg: MediaWorkflowFileMessage): Promise<void> {
    this.logger.debug(`Verify transcode configuration: ${JSON.stringify(msg)}`);

    const step = await this.reporter.createStep(
      msg.workflowId,
      "verify_transcode",
    );
    const workflow = this.workflows.open(
      msg.workflowId,
      msg.mediaExtension,
      "verify_transcode",
    );

    try {
      await workflow.init();

      this.logger.log("Downloading transcode job config...");
      const transcodeJob = await workflow.downloadFile<HandbrakeJobFile>(
        "transcodeJob.json",
        "transcodeJob.json",
      );

      this.logger.log("Downloading transcode metadata config...");
      const transcodeMetadata = await workflow.downloadFile<TranscodeMetadata>(
        "transcodeMetadata.json",
        "transcodeMetadata.json",
      );

      if (transcodeMetadata.verify || transcodeMetadata.subtitleTrackIndex) {
        if (!fs.existsSync(`${workflow.stagingDir}/transcodeJob.json`)) {
          throw new Error("Could not load base transcode job config");
        }

        this.logger.log("Downloading source asset...");
        await workflow.fetchSource(step, msg.mediaExtension);

        let subtitles: SubtitleEntry[] | undefined = undefined;

        if (transcodeMetadata.subtitleTrackIndex) {
          subtitles = await this.extractSubtitles(
            workflow,
            step,
            transcodeMetadata,
          );

          this.logger.debug(`Subtitle entries: ${subtitles.length}`);
        }

        const height = sampleHeight(transcodeMetadata.height);

        sampleStartTimes(transcodeMetadata.duration, subtitles).forEach(
          (startTime, i) => {
            const job = planSample(
              transcodeJob,
              startTime,
              height,
              `${workflow.stagingDir}/original.${msg.mediaExtension}`,
              `${workflow.stagingDir}/sample${i}.mp4`,
            );

            this.logger.debug(
              `Writing sample ${i} job file: ${workflow.stagingDir}/sampleJob${i}.json`,
            );
            fs.writeFileSync(
              `${workflow.stagingDir}/sampleJob${i}.json`,
              JSON.stringify(job, null, 2),
            );
          },
        );

        const filesToUpload: Record<string, string> = {};
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const sampleId = `sample_${i}` as MediaAssetWorkflowSubStepType;

          const subStep = await this.reporter.createSubStep(
            workflow.workflowId,
            step.id,
            sampleId,
          );

          try {
            this.logger.debug(`Transcoding sample ${i}...`);
            await workflow.transcode(
              `${workflow.stagingDir}/sampleJob${i}.json`,
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
            this.logger.debug(`Transcoding sample ${i} completed successfully`);
            filesToUpload[`sample${i}.mp4`] =
              `/Dionysus/workflow/${workflow.workflowId}/sample${i}.mp4`;
            await this.reporter.updateStepStatus(
              workflow.workflowId,
              subStep.id,
              "success",
            );
          } catch (e) {
            this.logger.error(e instanceof Error ? e.stack : String(e));
            await this.reporter.updateStepStatus(
              workflow.workflowId,
              subStep.id,
              "failed",
            );
            throw e;
          }
        }

        const uploadStep = await this.reporter.createSubStep(
          workflow.workflowId,
          step.id,
          "upload_artifacts",
        );

        try {
          if (this.media.skipSshUpload) {
            this.logger.error("Skipping SSH upload");
          } else {
            await workflow.upload(
              filesToUpload,
              {
                host: this.media.cdn.host,
                port: 22,
                username: this.media.cdn.username!,
                password: this.media.cdn.password!,
              },
              async (progress, _bytesTransferred) => {
                await this.reporter.updateStepProgress(
                  workflow.workflowId,
                  step.id,
                  progress,
                );
              },
            );
          }

          await this.reporter.updateStepStatus(
            workflow.workflowId,
            uploadStep.id,
            "success",
          );
        } catch (e) {
          this.logger.error(e instanceof Error ? e.stack : String(e));
          await this.reporter.updateStepStatus(
            workflow.workflowId,
            uploadStep.id,
            "failed",
          );
          throw e;
        }

        await this.reporter.updateStepStatus(
          msg.workflowId,
          step.id,
          "pending",
        );
      } else {
        this.logger.log(
          "No verification required, transcode is not marked for verification or no subtitle index found",
        );
        await this.mediaApi.verifyMediaAssetTranscodeConfiguration(
          workflow.workflowId,
          step.id,
        );
        await this.reporter.updateStepStatus(
          msg.workflowId,
          step.id,
          "skipped",
        );
      }
    } catch (e) {
      this.logger.error("Unable to verify transcode:", e);
      await this.reporter.updateStepStatus(msg.workflowId, step.id, "failed");
    } finally {
      try {
        fs.rmSync(workflow.stagingDir, { recursive: true, force: true });
      } catch (e) {
        this.logger.error(
          `Failed to remove temp directory ${workflow.stagingDir}: ${e}`,
        );
      }
    }
  }

  private async extractSubtitles(
    workflow: MediaWorkflow,
    step: MediaAssetWorkflowStep,
    transcodeMetadata: TranscodeMetadata,
  ): Promise<SubtitleEntry[]> {
    const subStep = await this.reporter.createSubStep(
      workflow.workflowId,
      step.id,
      "extract_srt",
    );

    try {
      await workflow.extractSrt(transcodeMetadata.subtitleTrackIndex! - 1);
      const subtitles = JSON.parse(
        parseFile(
          fs.readFileSync(`${workflow.stagingDir}/subtitle.srt`, "utf8"),
          "full",
        ),
      );
      await this.reporter.updateStepStatus(
        workflow.workflowId,
        subStep.id,
        "success",
      );

      return subtitles;
    } catch (e) {
      await this.reporter.updateStepStatus(
        workflow.workflowId,
        subStep.id,
        "failed",
      );
      throw e;
    }
  }
}
