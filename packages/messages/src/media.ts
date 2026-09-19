import { exchange, route } from "./routing";

/**
 * Media asset workflows: metadata extraction, transcode configuration,
 * transcoding and cleanup. Published by the API and by the asset agents
 * themselves as a workflow advances.
 */

export const MEDIA_TRIGGER_EXCHANGE = exchange("media.trigger", "topic");

/** A step of a media workflow that works on the workflow's media file. */
export interface MediaWorkflowFileMessage {
  workflowId: string;
  /** Extension of the file the step works on, e.g. `mkv`. */
  mediaExtension: string;
}

export interface ExtractMediaMetadataMessage extends MediaWorkflowFileMessage {
  mediaType: "original" | "transcode";
}

export interface TranscodeConfigurationMessage extends MediaWorkflowFileMessage {
  configurationStepId: string;
  videoStreamIndex: number;
  audioStreamIndex: number;
  subtitleStreamIndex?: number;
  transcodeVerificationRequired: boolean;
}

/**
 * Transcode the workflow's media. The API publishes it when a transcode
 * configuration is verified, with the configuration step and no extension;
 * the asset agents publish it with the extension. (The asset agents read
 * the extension from the message today: see the roadmap.)
 */
export interface TranscodeMediaMessage {
  workflowId: string;
  configurationStepId?: string;
  mediaExtension?: string;
}

export interface DeleteMediaWorkflowMessage {
  workflowId: string;
}

const mediaRoute = <P>(jobType: string) =>
  route<P>(MEDIA_TRIGGER_EXCHANGE, `jobType.${jobType}`);

/** Each route `jobType.<name>` → queue `media.<name>.trigger`. */
export const MEDIA_ROUTES = {
  extractMetadata: mediaRoute<ExtractMediaMetadataMessage>("extractMetadata"),
  configureTranscode:
    mediaRoute<MediaWorkflowFileMessage>("configureTranscode"),
  transcodeConfiguration: mediaRoute<TranscodeConfigurationMessage>(
    "transcodeConfiguration",
  ),
  verifyTranscodeConfiguration: mediaRoute<MediaWorkflowFileMessage>(
    "verifyTranscodeConfiguration",
  ),
  transcode: mediaRoute<TranscodeMediaMessage>("transcode"),
  cleanup: mediaRoute<MediaWorkflowFileMessage>("cleanup"),
  deleteWorkflow: mediaRoute<DeleteMediaWorkflowMessage>("deleteWorkflow"),
  /** Consumed by the asset agents' test handler; any payload. */
  test: mediaRoute<Record<string, unknown>>("test"),
} as const;
