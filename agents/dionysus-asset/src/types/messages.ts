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
