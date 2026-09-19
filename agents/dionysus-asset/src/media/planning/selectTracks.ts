import { Logger } from "@nestjs/common";
import type { HandbrakeScan, HandbrakeTitle } from "../../tools/handbrake/scan";

const logger = new Logger("selectTracks");

/** The transcode's tracks, and whether a person needs to look at them. */
export type TrackSelection = {
  title: HandbrakeTitle;
  /** 1-based, as HandBrake numbers audio tracks. */
  audioTrackIndex: number;
  /** 1-based; burned in (e.g. forced English subtitles). */
  subtitleTrackIndex?: number;
  /** The choice is ambiguous: leave the configuration for approval. */
  configurationRequiresApproval: boolean;
  /** Subtitles are involved: verify the transcode with samples. */
  transcodeVerificationRequired: boolean;
};

/**
 * Picks the main feature's tracks: English audio when there is a choice,
 * and forced English subtitles.
 */
export const selectTracks = (metadata: HandbrakeScan): TrackSelection => {
  const title = metadata.TitleList[metadata.MainFeature];
  const videoTracks: unknown[] = [title];
  const audioTracks = title.AudioList;
  const subtitleTracks = title.SubtitleList;

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
    logger.log(
      "Multiple video tracks found, flagging configuration for approval",
    );
    configurationRequiresApproval = true;
  }

  if (audioTracks.length > 1) {
    const engAudioTracks: { index: number }[] = [];

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
      logger.log(
        `Multiple 'eng' audio tracks found, flagging configuration for approval, selecting first track - ${engAudioTracks[0].index}`,
      );
      audioTrackIndex = engAudioTracks[0].index;
      configurationRequiresApproval = true;
    } else if (engAudioTracks.length === 1) {
      audioTrackIndex = engAudioTracks[0].index;
    }
  }

  if (subtitleTracks.length > 0) {
    const engSubtitleTracks: { index: number; forced: boolean }[] = [];

    subtitleTracks.forEach((track) => {
      if (track.LanguageCode === "eng") {
        engSubtitleTracks.push({
          index: track.TrackNumber,
          forced: track.Attributes.Forced === true,
        });
      }

      if (engSubtitleTracks.length > 1) {
        logger.log(
          "Multiple 'eng' subtitle track found, flagging transcode for verification",
        );

        engSubtitleTracks.forEach((subTrack) => {
          if (subTrack.forced) {
            logger.log(
              `'eng' subtitle track at index ${subTrack.index} is forced, flagging transcode for verification`,
            );

            subtitleTrackIndex = subTrack.index;
            transcodeVerificationRequired = true;
          }
        });

        if (!subtitleTrackIndex) {
          logger.log(
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

  return {
    title,
    audioTrackIndex,
    subtitleTrackIndex,
    configurationRequiresApproval,
    transcodeVerificationRequired,
  };
};
