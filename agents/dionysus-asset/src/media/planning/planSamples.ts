import type { HandbrakeJobFile } from "../../tools/handbrake/jobFile";
import { setResolution } from "../../tools/handbrake/jobFile";

/** A subtitle entry as `subsrt` parses it. */
export type SubtitleEntry = { start: string };

/** The number of verification samples. */
export const SAMPLE_COUNT = 6;

/** The length of a sample, in seconds. */
export const SAMPLE_SECONDS = 90;

/** Samples are 480 wide. */
export const SAMPLE_WIDTH = 480;

/** Milliseconds of an SRT timestamp (`HH:mm:ss,SSS`). */
export const timestampToMs = (timestamp: string): number => {
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
};

/**
 * Where the samples start, in whole seconds: spread over the subtitle
 * entries when there are subtitles (so each sample shows some), otherwise
 * over the duration.
 */
export const sampleStartTimes = (
  duration: number,
  subtitles?: SubtitleEntry[],
): number[] => {
  const sampleStep = subtitles
    ? subtitles.length / SAMPLE_COUNT
    : duration / SAMPLE_COUNT;
  const times: number[] = [];

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    times.push(
      Math.floor(
        subtitles
          ? timestampToMs(subtitles[Math.floor(sampleStep * i)].start) / 1000
          : sampleStep * i,
      ),
    );
  }

  return times;
};

/** The sample height for a source of the given height (as if 1920 wide). */
export const sampleHeight = (height: number): number =>
  Math.ceil((SAMPLE_WIDTH / 1920) * height);

/**
 * A sample's HandBrake job: the transcode job, scaled down and limited to
 * {@link SAMPLE_SECONDS} from `startTime`.
 */
export const planSample = (
  transcodeJob: HandbrakeJobFile,
  startTime: number,
  height: number,
  sourceFile: string,
  destinationFile: string,
): HandbrakeJobFile => {
  const job = structuredClone([transcodeJob[0]]);

  setResolution(job, SAMPLE_WIDTH, height);
  job[0].Job.Source.Range = {
    Type: "time",
    Start: startTime * 90000,
    End: (startTime + SAMPLE_SECONDS) * 90000,
  };
  job[0].Job.Source.Path = sourceFile;
  job[0].Job.Destination.File = destinationFile;

  return job;
};
