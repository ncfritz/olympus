import type { HandbrakeJobFile } from "../../tools/handbrake/jobFile";
import { setResolution } from "../../tools/handbrake/jobFile";
import type { HandbrakeScan } from "../../tools/handbrake/scan";
import { DEFAULT_HANDBRAKE_CONFIG } from "./defaultHandbrakeJob";

/** The tracks of an approved transcode configuration (1-based). */
export type TranscodeTracks = {
  videoStreamIndex: number;
  audioStreamIndex: number;
  subtitleStreamIndex?: number;
};

export type TranscodePlan = {
  job: HandbrakeJobFile;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  /** Seconds. */
  duration: number;
};

/**
 * The HandBrake job of a transcode: the default job with the chosen title
 * (scaled down to 1920 wide at most), audio and burned-in subtitles, or
 * forced subtitles found by HandBrake's search when none was chosen.
 */
export const planTranscode = (
  handbrakeMetadata: HandbrakeScan,
  msg: TranscodeTracks,
  sourceFile: string,
  destinationFile: string,
): TranscodePlan => {
  const config = structuredClone(
    DEFAULT_HANDBRAKE_CONFIG,
  ) as unknown as HandbrakeJobFile;
  const title = handbrakeMetadata.TitleList.filter(
    (t) => t.Index === msg.videoStreamIndex,
  )[0];
  const subtitleMetadata = msg.subtitleStreamIndex
    ? title.SubtitleList.filter(
        (s) => s.TrackNumber === msg.subtitleStreamIndex,
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

  setResolution(config, width, height);

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

  return {
    job: config,
    originalWidth,
    originalHeight,
    width,
    height,
    duration: title.Duration.Ticks / 90000,
  };
};
