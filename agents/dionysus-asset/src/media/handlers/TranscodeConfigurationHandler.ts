import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { publishMessage } from "@ncfritz/olympus-messages";
import { Injectable, Logger } from "@nestjs/common";
import fs from "fs";
import { MediaApi } from "../../api/MediaApi";
import {
  MEDIA_ROUTES,
  MEDIA_SUBSCRIPTIONS,
  type TranscodeConfigurationMessage,
} from "../../messaging";
import type { HandbrakeScan } from "../../tools/handbrake/scan";
import { planTranscode } from "../planning/planTranscode";
import { MediaReporter } from "../services/MediaReporter";
import { MediaWorkflows } from "../services/MediaWorkflows";

/**
 * Writes the HandBrake job (transcodeJob.json) and transcodeMetadata.json
 * for an approved configuration, then asks for it to be verified.
 */
@Injectable()
export class TranscodeConfigurationHandler {
  private readonly logger = new Logger(TranscodeConfigurationHandler.name);

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly mediaApi: MediaApi,
    private readonly reporter: MediaReporter,
    private readonly workflows: MediaWorkflows,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.transcodeConfiguration)
  public async handle(msg: TranscodeConfigurationMessage): Promise<void> {
    this.logger.debug("TranscodeConfigurationHandler");
    this.logger.debug(msg);

    const workflow = this.workflows.open(msg.workflowId, msg.mediaExtension);
    const step = await this.mediaApi.describeMediaAssetWorkflowStep(
      msg.workflowId,
      msg.configurationStepId,
    );

    const configFile = `${workflow.stagingDir}/transcodeJob.json`;
    const handbrakeMetadataFile = `${workflow.stagingDir}/handbrakeMetadata.json`;
    const transcodeMetadataFile = `${workflow.stagingDir}/transcodeMetadata.json`;
    const sourceFile = `${workflow.stagingDir}/original.${msg.mediaExtension}`;
    const destinationFile = `${workflow.stagingDir}/transcoded.mp4`;

    if (!fs.existsSync(handbrakeMetadataFile)) {
      throw new Error(
        `Handbrake metadata file does not exist: ${handbrakeMetadataFile}`,
      );
    }

    const handbrakeMetadata = JSON.parse(
      fs.readFileSync(handbrakeMetadataFile, "utf8"),
    ) as HandbrakeScan;
    const {
      job: config,
      originalWidth,
      originalHeight,
      width,
      height,
      duration,
    } = planTranscode(handbrakeMetadata, msg, sourceFile, destinationFile);

    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    fs.writeFileSync(
      transcodeMetadataFile,
      JSON.stringify(
        {
          mediaExtension: msg.mediaExtension,
          videoTrackIndex: msg.videoStreamIndex,
          audioTrackIndex: msg.audioStreamIndex,
          subtitleTrackIndex: msg.subtitleStreamIndex,
          verify: msg.transcodeVerificationRequired,
          originalWidth: originalWidth,
          originalHeight: originalHeight,
          width: width,
          height: height,
          duration: duration,
          size: fs.statSync(sourceFile).size,
        },
        null,
        2,
      ),
    );
    await this.reporter.updateStepStatus(msg.workflowId, step.id, "success");
    await publishMessage(
      this.amqpConnection,
      MEDIA_ROUTES.verifyTranscodeConfiguration,
      {
        workflowId: msg.workflowId,
        mediaExtension: msg.mediaExtension,
      },
      {
        persistent: true,
      },
    );
  }
}
