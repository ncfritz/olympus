import type {
  ContentIngestionWorkflow,
  ContentIngestionWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import axios from "axios";
import * as cliProgress from "cli-progress";
import fs, { PathLike } from "fs";
import { PassThrough } from "stream";
import type { ContentReporter } from "./ContentReporter";
import { USER_AGENT } from "./userAgent";

export interface DownloadStepProps {
  readonly workDir: PathLike;
  readonly title: string;
  readonly segmentUrls: string[];
}

/** Downloads a video's segments, in order, into one file. */
export const downloadSegments = async (
  props: DownloadStepProps,
  workflow: ContentIngestionWorkflow,
  workflowStep: ContentIngestionWorkflowStep,
  reporter: ContentReporter,
): Promise<string> => {
  const rawAsset = `${props.workDir}/${props.title}.mp4`;
  const writer = fs.createWriteStream(rawAsset);
  const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
  progress.start(100, 0);
  let count = 0;

  for (const segmentUrl of props.segmentUrls) {
    const passThrough = new PassThrough();
    passThrough.pipe(writer, { end: false });

    const response = await axios({
      method: "GET",
      url: segmentUrl,
      responseType: "stream",
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    response.data.pipe(passThrough);

    await new Promise<void>((resolve, reject) => {
      passThrough.on("finish", resolve);
      passThrough.on("error", reject);
    });

    const progressPercent = (++count / props.segmentUrls.length) * 100;
    progress.update(progressPercent);
    await reporter.updateStepProgress(
      workflow.id,
      workflowStep.id,
      progressPercent,
    );

    await sleep(300);
  }

  progress.stop();
  writer.end();

  return rawAsset;
};

const sleep = async (ms: number): Promise<void> => {
  return new Promise((r) => setTimeout(r, ms));
};
