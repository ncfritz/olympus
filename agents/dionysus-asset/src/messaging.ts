import {
  contentJobRoute,
  type ContentJobType,
  DOWNLOAD_UPDATE_EXCHANGE,
  MEDIA_ROUTES,
  type MessageRoute,
  RAW_INGEST_ROUTE,
  START_DOWNLOAD_ROUTE,
  subscription,
} from "@ncfritz/olympus-messages";

/**
 * RabbitMQ names this agent consumes and publishes. Exchanges, routing keys
 * and payloads come from the shared contract (@ncfritz/olympus-messages);
 * the queues and channels are the agent's own.
 */
export {
  type ContentAssetJobMessage,
  type DeleteMediaWorkflowMessage,
  type DownloadUpdateMessage,
  type ExtractMediaMetadataMessage,
  MEDIA_ROUTES,
  type MediaWorkflowFileMessage,
  type RawIngestionMessage,
  type StartDownloadMessage,
  type TranscodeConfigurationMessage,
  type TranscodeMediaMessage,
} from "@ncfritz/olympus-messages";

/** Channels and their prefetch: how many messages each consumes at once. */
export const CHANNELS = {
  transcodeMediaChannel: 1,
} as const;

const contentSubscription = (jobType: ContentJobType) =>
  subscription(contentJobRoute(jobType), `content.${jobType}.trigger`);

/** @RabbitSubscribe options of the content handlers. */
export const CONTENT_SUBSCRIPTIONS = {
  rawIngest: subscription(RAW_INGEST_ROUTE, "content.rawIngest.trigger"),
  hls: contentSubscription("hls"),
  thumbnail: contentSubscription("thumbnail"),
  delete: contentSubscription("delete"),
};

const mediaSubscription = (name: keyof typeof MEDIA_ROUTES) =>
  subscription(
    MEDIA_ROUTES[name] as MessageRoute<unknown>,
    `media.${name}.trigger`,
  );

/** @RabbitSubscribe options of the media workflow handlers. */
export const MEDIA_SUBSCRIPTIONS = {
  extractMetadata: mediaSubscription("extractMetadata"),
  configureTranscode: mediaSubscription("configureTranscode"),
  transcodeConfiguration: mediaSubscription("transcodeConfiguration"),
  verifyTranscodeConfiguration: mediaSubscription(
    "verifyTranscodeConfiguration",
  ),
  /** One transcode at a time; a transcode holds its message up to 9 hours. */
  transcode: {
    ...mediaSubscription("transcode"),
    queueOptions: {
      channel: "transcodeMediaChannel" satisfies keyof typeof CHANNELS,
      arguments: { "x-consumer-timeout": 9 * 60 * 60 * 1000 },
    },
  },
  cleanup: mediaSubscription("cleanup"),
  deleteWorkflow: mediaSubscription("deleteWorkflow"),
  test: mediaSubscription("test"),
};

/** @RabbitSubscribe options of the download handlers. */
export const DOWNLOAD_SUBSCRIPTIONS = {
  start: subscription(START_DOWNLOAD_ROUTE, "download.trigger"),
  /** Every NZBGet event (`update.*`). */
  update: {
    exchange: DOWNLOAD_UPDATE_EXCHANGE.name,
    routingKey: "update.*",
    queue: "download.update",
  },
};
