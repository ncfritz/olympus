import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  MediaAssetWorkflowStep,
  MediaAssetWorkflowSubStepType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import fs from "fs";
import mediaApi from "../../api/mediaApi";
import { type TranscodeMediaMessage } from "../../types/messages";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import {
  createStep,
  createSubStep,
  updateStepProgress,
  updateStepStatus,
} from "../../workflow/media/reporter";
import { MediaWorkflow } from "../../workflow/media/workflow";
import { logger } from "../../util/logger";
import { parseFile } from "subparse";

@Injectable()
export class VerifyTranscodeConfigurationHandler {
  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.verifyTranscodeConfiguration.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.verifyTranscodeConfiguration`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: TranscodeMediaMessage, amqMsg: ConsumeMessage) {
    console.log("VerifyTranscodeConfigurationHandler");
    console.log(msg);

    const step = await createStep(msg.workflowId, "verify_transcode");
    const workflow = new MediaWorkflow(
      msg.workflowId,
      msg.mediaExtension,
      "verify_transcode",
    );

    try {
      await workflow.init();

      logger.info("Downloading transcode job config...");
      const transcodeJob = await workflow.downloadFile(
        "transcodeJob.json",
        "transcodeJob.json",
      );

      logger.info("Downloading transcode metadata config...");
      const transcodeMetadata = await workflow.downloadFile(
        "transcodeMetadata.json",
        "transcodeMetadata.json",
      );

      if (transcodeMetadata.verify || transcodeMetadata.subtitleTrackIndex) {
        if (!fs.existsSync(`${workflow.stagingDir}/transcodeJob.json`)) {
          throw new Error("Could not load base transcode job config");
        }

        logger.info("Downloading source asset...");
        await workflow.fetchSource(step, msg.mediaExtension);

        let subtitles = undefined;

        if (transcodeMetadata.subtitleTrackIndex) {
          subtitles = await this.extractSubtitles(
            workflow,
            step,
            transcodeMetadata,
          );

          logger.debug(`Subtitle entries: ${subtitles.length}`);
        }

        const width = 480;
        const height = Math.ceil((480 / 1920) * transcodeMetadata.height);
        const sampleStep = subtitles
          ? subtitles.length / 6
          : transcodeMetadata.duration / 6;
        const sampleTimes: number[] = [];

        for (let i = 0; i < 6; i++) {
          sampleTimes.push(
            Math.floor(
              subtitles
                ? this.timestampToMs(
                    subtitles[Math.floor(sampleStep * i)].start,
                  ) / 1000
                : sampleStep * i,
            ),
          );
        }

        sampleTimes.forEach((startTime, i) => {
          const config = { ...transcodeJob };
          const resIndex = config[0].Job.Filters.FilterList.findIndex(
            (filter: any) => {
              return filter.ID === 20;
            },
          );

          if (resIndex > -1) {
            config[0].Job.Filters.FilterList[resIndex].Settings.width =
              `${width}`;
            config[0].Job.Filters.FilterList[resIndex].Settings.height =
              `${height}`;
          }

          config[0].Job.Source.Range = {
            Type: "time",
            Start: startTime * 90000,
            End: (startTime + 90) * 90000,
          };
          config[0].Job.Source.Path = `${workflow.stagingDir}/original.${msg.mediaExtension}`;
          config[0].Job.Destination.File = `${workflow.stagingDir}/sample${i}.mp4`;

          logger.debug(
            `Writing sample ${i} job file: ${workflow.stagingDir}/sampleJob${i}.json`,
          );
          fs.writeFileSync(
            `${workflow.stagingDir}/sampleJob${i}.json`,
            JSON.stringify([config[0]], null, 2),
          );
        });

        const filesToUpload: Record<string, string> = {};
        for (let i = 0; i < 6; i++) {
          // @ts-expect-error this is ok
          const sampleId: MediaAssetWorkflowSubStepType = `sample_${i}`;

          const subStep = await createSubStep(
            workflow.workflowId,
            step.id,
            sampleId,
          );

          try {
            logger.debug(`Transcoding sample ${i}...`);
            await workflow.transcode(
              `${workflow.stagingDir}/sampleJob${i}.json`,
              async (progress) => {
                try {
                  await updateStepProgress(
                    workflow.workflowId,
                    step.id,
                    progress,
                  );
                } catch (e) {
                  logger.error("Unable to update transcode progress...");
                }
              },
            );
            logger.debug(`Transcoding sample ${i} completed successfully`);
            filesToUpload[`sample${i}.mp4`] =
              `/Dionysus/workflow/${workflow.workflowId}/sample${i}.mp4`;
            await updateStepStatus(workflow.workflowId, subStep.id, "success");
          } catch (e) {
            console.log(e);
            await updateStepStatus(workflow.workflowId, subStep.id, "failed");
            throw e;
          }
        }

        const uploadStep = await createSubStep(
          workflow.workflowId,
          step.id,
          "upload_artifacts",
        );

        try {
          if (process.env.DIONYSUS_SKIP_SSH_UPLOAD === "true") {
            logger.error("Skipping SSH upload");
          } else {
            await workflow.upload(
              filesToUpload,
              {
                host: process.env.DIONYSUS_CDN_SSH_HOST!,
                port: 22,
                username: process.env.DIONYSUS_CDN_SSH_USERNAME!,
                password: process.env.DIONYSUS_CDN_SSH_PASSWORD!,
              },
              async (progress, bytesTransferred) => {
                await updateStepProgress(
                  workflow.workflowId,
                  step.id,
                  progress,
                );
              },
            );
          }

          await updateStepStatus(workflow.workflowId, uploadStep.id, "success");
        } catch (e) {
          console.log(e);
          await updateStepStatus(workflow.workflowId, uploadStep.id, "failed");
          throw e;
        }

        await updateStepStatus(msg.workflowId, step.id, "pending");
      } else {
        logger.info(
          "No verification required, transcode is not marked for verification or no subtitle index found",
        );
        await mediaApi.verifyMediaAssetTranscodeConfiguration(
          workflow.workflowId,
          step.id,
        );
        await updateStepStatus(msg.workflowId, step.id, "skipped");
      }
    } catch (e) {
      logger.error("Unable to verify transcode:", e);
      await updateStepStatus(msg.workflowId, step.id, "failed");
    } finally {
      try {
        fs.rmSync(workflow.stagingDir, { recursive: true, force: true });
      } catch (e) {
        logger.error(
          `Failed to remove temp directory ${workflow.stagingDir}: ${e}`,
        );
      }
    }
  }

  private async extractSubtitles(
    workflow: MediaWorkflow,
    step: MediaAssetWorkflowStep,
    transcodeMetadata: any,
  ) {
    const subStep = await createSubStep(
      workflow.workflowId,
      step.id,
      "extract_srt",
    );

    try {
      await workflow.extractSrt(transcodeMetadata.subtitleTrackIndex - 1);
      const subtitles = JSON.parse(
        parseFile(
          fs.readFileSync(`${workflow.stagingDir}/subtitle.srt`, "utf8"),
          "full",
        ),
      );
      await updateStepStatus(workflow.workflowId, subStep.id, "success");

      return subtitles;
    } catch (e) {
      await updateStepStatus(workflow.workflowId, subStep.id, "failed");
      throw e;
    }
  }

  private timestampToMs(timestamp: string): number {
    // Split by ':' or ',' to handle HH:mm:ss,sss
    const parts = timestamp.split(/[: ,]/);
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);
    const milliseconds = parseInt(parts[3]);

    return (
      hours * (60 * 60 * 1000) +
      minutes * (60 * 1000) +
      seconds * 1000 +
      milliseconds
    );
  }
}
