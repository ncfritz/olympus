import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import fs from "fs";
import mediaApi from "../../api/mediaApi";
import { type TranscodeConfigurationMessage } from "../../types/messages";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import * as HANDBRAKE_DEFAULT_CONFIG from "../../handbrakeDefault.json" with { type: "json" };
import { updateStepStatus } from "../../workflow/media/reporter";
import { MediaWorkflow } from "../../workflow/media/workflow";

@Injectable()
export class TranscodeConfigurationHandler {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.transcodeConfiguration.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.transcodeConfiguration`,
  })
  public async handle(
    msg: TranscodeConfigurationMessage,
    amqMsg: ConsumeMessage,
  ) {
    const workflow = new MediaWorkflow(msg.workflowId, msg.mediaExtension);
    const step = await mediaApi.describeMediaAssetWorkflowStep(
      msg.workflowId,
      msg.configurationStepId,
    );

    const config = JSON.parse(JSON.stringify(HANDBRAKE_DEFAULT_CONFIG));
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
    );
    const title = handbrakeMetadata.TitleList.filter(
      (t: any) => t.Index === msg.videoStreamIndex,
    )[0];
    const subtitleMetadata = msg.subtitleStreamIndex
      ? title.SubtitleList.filter(
          (s: any) => s.TrackNumber === msg.subtitleStreamIndex,
        )[0]
      : undefined;
    const originalWidth = title.Geometry.Width;
    const originalHeight = title.Geometry.Height;
    let width = originalWidth;
    let height = originalHeight;

    if (originalWidth > 1920) {
      const ratio = 1920 / originalWidth;
      width = 1920;
      height = Math.floor(ratio * originalHeight);
    }

    const resIndex = config[0].Job.Filters.FilterList.findIndex(
      (filter: any) => {
        return filter.ID === 20;
      },
    );

    if (resIndex > -1) {
      config[0].Job.Filters.FilterList[resIndex].Settings.width = `${width}`;
      config[0].Job.Filters.FilterList[resIndex].Settings.height = `${height}`;
    }

    config[0].Job.Source.Range = {
      Type: "time",
      Start: 0,
      End: title.Duration.Ticks,
    };

    config[0].Job.Source.Path = sourceFile;
    config[0].Job.Source.Title = msg.videoStreamIndex;
    config[0].Job.Destination.File = destinationFile;
    config[0].Job.Audio.AudioList[0].Track = msg.audioStreamIndex - 1;
    config[0].Job.Audio.AudioList[1].Track = msg.audioStreamIndex - 1;
    config[0].Job.Subtitle.SubtitleList = [];

    if (subtitleMetadata) {
      // Delete the Subtitle.Search element
      delete config[0].Job.Subtitle.Search;

      config[0].Job.Subtitle.SubtitleList.push({
        Burn: true,
        Default: false,
        Forced: false,
        ID: subtitleMetadata.TrackNumber,
        Offset: 0,
        Track: subtitleMetadata.TrackNumber - 1,
        Name: subtitleMetadata.Name,
      });
    } else {
      config[0].Job.Subtitle.Search = {
        Burn: true,
        Default: false,
        Enable: true,
        Forced: true,
      };
    }

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
          duration: title.Duration.Ticks / 90000,
          size: fs.statSync(sourceFile).size,
        },
        null,
        2,
      ),
    );
    await updateStepStatus(msg.workflowId, step.id, "success");
    await this.amqpConnection.publish(
      "media.trigger",
      `jobType.verifyTranscodeConfiguration`,
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
