import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import fs from "fs";
import { MediaApi } from "../../api/MediaApi";
import type { HandbrakeScan } from "../../tools/handbrake/scan";
import { selectTracks } from "../planning/selectTracks";
import {
  MEDIA_SUBSCRIPTIONS,
  type MediaWorkflowFileMessage,
} from "../../messaging";
import { MediaReporter } from "../services/MediaReporter";
import { MediaWorkflows } from "../services/MediaWorkflows";

/**
 * Picks the video, audio and subtitle tracks for the transcode from the
 * HandBrake scan: approves the configuration when the choice is clear,
 * otherwise leaves it pending for review.
 */
@Injectable()
export class ConfigureTranscodeHandler {
  private readonly logger = new Logger(ConfigureTranscodeHandler.name);

  constructor(
    private readonly mediaApi: MediaApi,
    private readonly reporter: MediaReporter,
    private readonly workflows: MediaWorkflows,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.configureTranscode)
  public async handle(msg: MediaWorkflowFileMessage): Promise<void> {
    this.logger.debug("ConfigureTranscodeHandler");
    this.logger.debug(msg);

    const step = await this.reporter.createStep(
      msg.workflowId,
      "configure_transcode",
    );

    try {
      const workflow = this.workflows.open(msg.workflowId, msg.mediaExtension);
      const metadataFile = `${workflow.stagingDir}/handbrakeMetadata.json`;
      const transcodeMetadataFile = `${workflow.stagingDir}/transcodeMetadata.json`;
      const metadata = JSON.parse(
        fs.readFileSync(metadataFile, "utf8"),
      ) as HandbrakeScan;

      if (metadata) {
        const {
          title,
          audioTrackIndex,
          subtitleTrackIndex,
          configurationRequiresApproval,
          transcodeVerificationRequired,
        } = selectTracks(metadata);

        if (configurationRequiresApproval) {
          // Write out a partial transcodeMetadata.json to persist the track indexes so the front-end can
          // pick them up for display.  This will be overwritten once the configuration is approved and the
          // transcodeConfigurationHandler runs.
          fs.writeFileSync(
            transcodeMetadataFile,
            JSON.stringify(
              {
                mediaExtension: msg.mediaExtension,
                videoTrackIndex: title.Index,
                audioTrackIndex: audioTrackIndex,
                subtitleTrackIndex: subtitleTrackIndex,
                verify: transcodeVerificationRequired,
                duration: title.Duration.Ticks / 90000,
              },
              null,
              2,
            ),
          );

          await this.reporter.updateStepStatus(
            msg.workflowId,
            step.id,
            "pending",
          );
        } else {
          await this.mediaApi.approveMediaAssetTranscodeConfiguration(
            msg.workflowId,
            step.id,
            msg.mediaExtension,
            title.Index,
            audioTrackIndex,
            subtitleTrackIndex,
            transcodeVerificationRequired,
          );

          await this.reporter.updateStepStatus(
            msg.workflowId,
            step.id,
            "success",
          );
        }
      } else {
        await this.reporter.updateStepStatus(msg.workflowId, step.id, "failed");
      }
    } catch {
      await this.reporter.updateStepStatus(msg.workflowId, step.id, "failed");
    }
  }
}
