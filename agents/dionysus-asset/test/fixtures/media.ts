import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import fs from "fs";
import os from "os";
import path from "path";
import { vi } from "vitest";
import type { MediaApi } from "../../src/api/MediaApi";
import type { MetadataApi } from "../../src/api/MetadataApi";
import type { MediaConfigType } from "../../src/config/configuration";
import type { MediaReporter } from "../../src/media/services/MediaReporter";
import type { MediaWorkflow } from "../../src/media/services/MediaWorkflow";
import type { MediaWorkflows } from "../../src/media/services/MediaWorkflows";
import { planTranscode } from "../../src/media/planning/planTranscode";
import type { TranscodeMetadata } from "../../src/media/planning/transcodeMetadata";
import { scan } from "./handbrake";

/**
 * Fakes around the transcode handler: a staged workflow whose tools
 * succeed (override a method to fail it), and recording API clients.
 */
export const transcodeFakes = (
  workflowInstance: Record<string, unknown> = {
    id: "wf-1",
    type: "movie",
    mediaId: 603,
  },
) => {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "transcode-"));
  const files: Record<string, unknown> = {
    "transcodeJob.json": planTranscode(
      scan(),
      { videoStreamIndex: 1, audioStreamIndex: 1 },
      "in",
      "out",
    ).job,
    "transcodeMetadata.json": {
      mediaExtension: "mkv",
      videoTrackIndex: 1,
      audioTrackIndex: 1,
      height: 1080,
      duration: 7200,
      size: 5000,
    } satisfies TranscodeMetadata,
  };

  const workflow = {
    workflowId: "wf-1",
    stagingDir,
    localDir: stagingDir,
    init: vi.fn(async () => {}),
    downloadFile: vi.fn(async (name: string) => files[name]),
    fetchSource: vi.fn(async () => {}),
    transcode: vi.fn(async () => {
      fs.writeFileSync(`${stagingDir}/transcoded.mp4`, "video");
    }),
    extractMetadata: vi.fn(async () => {
      fs.writeFileSync(
        `${stagingDir}/metadata.json`,
        JSON.stringify({
          streams: [
            {
              codec_type: "video",
              width: 1920,
              height: 1080,
              duration: "7200.5",
            },
          ],
        }),
      );
    }),
    upload: vi.fn(async () => {}),
    calculateOutputSha: vi.fn(async () => "sha"),
  };

  const mediaApi = {
    describeMediaAssetWorkflow: vi.fn(async () => workflowInstance),
    createMediaAsset: vi.fn(async () => ({})),
  };
  const metadataApi = {
    describeMovie: vi.fn(async () => ({
      title: "The Matrix",
      releaseDate: "1999-03-31",
    })),
    getTvEpisodeById: vi.fn(),
  };
  const reporter = {
    createStep: vi.fn(async (_id: string, type: string) => ({ id: type })),
    updateStepStatus: vi.fn(async () => {}),
    updateStepProgress: vi.fn(async () => {}),
  };
  const amqp = { publish: vi.fn(async () => true) };
  const media = {
    skipSshUpload: false,
    transcodeCleanup: false,
    cdn: { host: "cdn", username: "u", password: "p" },
    library: { host: "library", username: "u", password: "p" },
  } as MediaConfigType;

  return {
    stagingDir,
    files,
    workflow,
    mediaApi,
    metadataApi,
    reporter,
    amqp,
    media,
    deps: [
      media,
      amqp as unknown as AmqpConnection,
      mediaApi as unknown as MediaApi,
      metadataApi as unknown as MetadataApi,
      reporter as unknown as MediaReporter,
      {
        open: () => workflow as unknown as MediaWorkflow,
      } as unknown as MediaWorkflows,
    ] as const,
    cleanup: () => fs.rmSync(stagingDir, { recursive: true, force: true }),
  };
};
