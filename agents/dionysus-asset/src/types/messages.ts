import { MediaAssetSearchType } from "@ncfritz/olympus-sdk/dionysus";

export type RawIngestionMessage = {
  workflowId: string;
  assetLocation: string;
  originalFilename?: string;
  skipWorkflow?: boolean;
};

export type ThumbnailGenerationMessage = {
  assetId: string;
};

export type HlsGenerationMessage = {
  assetId: string;
};

export type DeleteAssetMessage = {
  assetId: string;
};

export type ExtractMediaMetadataMessage = {
  workflowId: string;
  mediaType: "original" | "transcode";
  mediaExtension: string;
};

export type ConfigureTranscodeMessage = {
  workflowId: string;
  mediaExtension: string;
};

export type TranscodeConfigurationMessage = {
  workflowId: string;
  configurationStepId: string;
  videoStreamIndex: number;
  audioStreamIndex: number;
  subtitleStreamIndex?: number;
  mediaExtension: string;
  transcodeVerificationRequired: boolean;
};

export type TranscodeMediaMessage = {
  workflowId: string;
  mediaExtension: string;
};

export type CleanupMessage = {
  workflowId: string;
  mediaExtension: string;
};

export type StartDownloadMessage = {
  mediaType: MediaAssetSearchType;
  mediaId: number;
  resultId: string;
  workflowId: string;
  downloadId: string;
  nzbId: string;
};

export type DeleteMediaWorkflowMessage = {
  workflowId: string;
};
