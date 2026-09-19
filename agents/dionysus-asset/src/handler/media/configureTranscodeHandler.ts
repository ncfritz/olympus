import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import fs from "fs";
import mediaApi from "../../api/mediaApi";
import { type ConfigureTranscodeMessage } from "../../types/messages";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { createStep, updateStepStatus } from "../../workflow/media/reporter";
import { MediaWorkflow } from "../../workflow/media/workflow";

@Injectable()
export class ConfigureTranscodeHandler {
  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.configureTranscode.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.configureTranscode`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: ConfigureTranscodeMessage, amqMsg: ConsumeMessage) {
    logger.debug("ConfigureTranscodeHandler");
    logger.debug(msg);

    const step = await createStep(msg.workflowId, "configure_transcode");

    try {
      const workflow = new MediaWorkflow(msg.workflowId, msg.mediaExtension);
      const metadataFile = `${workflow.stagingDir}/handbrakeMetadata.json`;
      const transcodeMetadataFile = `${workflow.stagingDir}/transcodeMetadata.json`;
      const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));

      if (metadata) {
        const title = metadata.TitleList[metadata.MainFeature];
        const videoTracks: any[] = [title];
        const audioTracks: any[] = title.AudioList;
        const subtitleTracks: any[] = title.SubtitleList;

        logger.debug(`Video Tracks: ${videoTracks.length}`);
        logger.debug(`Audio Tracks: ${audioTracks.length}`);
        logger.debug(`Subtitle Tracks: ${subtitleTracks.length}`);

        // Assume the media will be autoconfigured
        let configurationRequiresApproval = false;
        let transcodeVerificationRequired = false;
        let audioTrackIndex = 1;
        let subtitleTrackIndex: number | undefined = undefined;

        // We can autoconfigure the transcode IFF:
        // 1. There is only one video track - this check may be proceeded by culling the video list to remove any static
        //    media types like cover art, which is reported as a video stream
        // 2. There is only one audio track, OR we can reliably identify one audio track as "eng" language.  If there
        //    are multiple languages, and we cannot identify "eng" as being the ONLY default language or if "eng" is marked
        //    as dubbed, we should flag the transcode for verification to ensure the appropriate track was used.
        // 3. There is a subtitle track that we can identify as being BOTH "eng" and forced.  There may be SRT or other
        //    "eng" subtitles, but these should generally be ignored.  If ANY subtitle track is used, the transcode should
        //    be flagged for verification.
        if (videoTracks.length > 1) {
          logger.info(
            "Multiple video tracks found, flagging configuration for approval",
          );
          configurationRequiresApproval = true;
        }

        if (audioTracks.length > 1) {
          const engAudioTracks: any[] = [];

          audioTracks.forEach((track) => {
            logger.debug(
              `AudioTrack - LanguageCode: ${track.LanguageCode}, TrackNumber: ${track.TrackNumber}`,
            );

            if (track.LanguageCode === "eng") {
              logger.debug(`Found 'eng' audio track: ${track.TrackNumber}`);
              engAudioTracks.push({
                index: track.TrackNumber,
              });
            }
          });

          if (engAudioTracks.length > 1) {
            logger.info(
              `Multiple 'eng' audio tracks found, flagging configuration for approval, selecting first track - ${engAudioTracks[0].index}`,
            );
            audioTrackIndex = engAudioTracks[0].index;
            configurationRequiresApproval = true;
          } else if (engAudioTracks.length === 1) {
            audioTrackIndex = engAudioTracks[0].index;
          }
        }

        if (subtitleTracks.length > 0) {
          const engSubtitleTracks: any[] = [];

          subtitleTracks.forEach((track) => {
            if (track.LanguageCode === "eng") {
              engSubtitleTracks.push({
                index: track.TrackNumber,
                forced: track.Attributes.Forced === true,
              });
            }

            if (engSubtitleTracks.length > 1) {
              logger.info(
                "Multiple 'eng' subtitle track found, flagging transcode for verification",
              );

              engSubtitleTracks.forEach((subTrack) => {
                if (subTrack.forced) {
                  logger.info(
                    `'eng' subtitle track at index ${subTrack.index} is forced, flagging transcode for verification`,
                  );

                  subtitleTrackIndex = subTrack.index;
                  transcodeVerificationRequired = true;
                }
              });

              if (!subtitleTrackIndex) {
                logger.info(
                  "Multiple 'eng' subtitle tracks found, flagging config for approval",
                );
                configurationRequiresApproval = true;
              }
            } else if (
              engSubtitleTracks.length === 1 &&
              engSubtitleTracks[0].forced
            ) {
              subtitleTrackIndex = engSubtitleTracks[0].index;
              transcodeVerificationRequired = true;
            }
          });
        }

        if (subtitleTrackIndex) {
          transcodeVerificationRequired = true;
        }

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

          await updateStepStatus(msg.workflowId, step.id, "pending");
        } else {
          await mediaApi.approveMediaAssetTranscodeConfiguration(
            msg.workflowId,
            step.id,
            msg.mediaExtension,
            title.Index,
            audioTrackIndex,
            subtitleTrackIndex,
            transcodeVerificationRequired,
          );

          await updateStepStatus(msg.workflowId, step.id, "success");
        }
      } else {
        await updateStepStatus(msg.workflowId, step.id, "failed");
      }
    } catch {
      await updateStepStatus(msg.workflowId, step.id, "failed");
    }
  }
}
