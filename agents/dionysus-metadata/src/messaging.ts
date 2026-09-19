import { MessageHandlerErrorBehavior } from "@golevelup/nestjs-rabbitmq";
import {
  BATCH_JOB_COMPLETION_ROUTE,
  batchJobRoute,
  type MessageRoute,
  metadataJobRoute,
  type MetadataJobType,
  REDRIVE_JOB_ROUTE,
  START_WORKFLOW_ROUTE,
  subscription,
} from "@ncfritz/olympus-messages";

/**
 * RabbitMQ names this agent consumes and publishes. Exchanges, routing keys
 * and payloads come from the shared contract (@ncfritz/olympus-messages);
 * the queues and channels are the agent's own.
 */
export {
  BATCH_JOB_COMPLETION_ROUTE,
  type BatchJobCompletionMessage,
  type BatchJobMessage,
  type JobType,
  type MetadataFetchJobStatus,
  type MetadataJobMessage,
  type MetadataJobType,
  type RedriveJobMessage,
  type StartWorkflowMessage,
} from "@ncfritz/olympus-messages";

/** Channels and their prefetch: how many messages each consumes at once. */
export const CHANNELS = {
  metadataChannel: 30,
  batchJobsChannel: 1,
  tvSeriesChannel: 10,
  tvSeasonsChannel: 15,
  tvEpisodesChannel: 70,
  workflowChannel: 1,
} as const;

export type ChannelName = keyof typeof CHANNELS;

const HOUR = 60 * 60 * 1000;

/**
 * A batch job queue. The long exports get a longer consumer timeout: a job
 * holds its message until it finishes.
 */
const batchSubscription = (jobType: MetadataJobType, timeoutMs?: number) => ({
  ...subscription(batchJobRoute(jobType), `batchJob.${jobType}.trigger`),
  queueOptions: {
    channel: "batchJobsChannel" satisfies ChannelName,
    ...(timeoutMs ? { arguments: { "x-consumer-timeout": timeoutMs } } : {}),
  },
  errorBehavior: MessageHandlerErrorBehavior.NACK,
});

/** @RabbitSubscribe options of the batch handlers, by job type. */
export const BATCH_SUBSCRIPTIONS = {
  certifications: batchSubscription("certifications"),
  collections: batchSubscription("collections"),
  countries: batchSubscription("countries"),
  genres: batchSubscription("genres"),
  keywords: batchSubscription("keywords"),
  languages: batchSubscription("languages"),
  movies: batchSubscription("movies", 4 * HOUR),
  people: batchSubscription("people", 12 * HOUR),
  production_companies: batchSubscription("production_companies"),
  tv_networks: batchSubscription("tv_networks"),
  tv_series: batchSubscription("tv_series"),
};

/** Redrive: no error behavior of its own (the library default). */
export const REDRIVE_SUBSCRIPTION = {
  ...subscription(REDRIVE_JOB_ROUTE, "batchJob.redrive.trigger"),
  queueOptions: {
    channel: "batchJobsChannel" satisfies ChannelName,
    arguments: { "x-consumer-timeout": 3 * HOUR },
  },
};

const entitySubscription = (
  entityType: MetadataJobType,
  channel: ChannelName,
) => ({
  ...subscription(
    metadataJobRoute(entityType),
    `metadataJob.${entityType}.trigger`,
  ),
  queueOptions: { channel },
  errorBehavior: MessageHandlerErrorBehavior.ACK,
});

/** @RabbitSubscribe options of the entity (metadata) handlers. */
export const ENTITY_SUBSCRIPTIONS = {
  collections: entitySubscription("collections", "metadataChannel"),
  movies: entitySubscription("movies", "metadataChannel"),
  people: entitySubscription("people", "metadataChannel"),
  production_companies: entitySubscription(
    "production_companies",
    "metadataChannel",
  ),
  tv_networks: entitySubscription("tv_networks", "metadataChannel"),
  tv_series: entitySubscription("tv_series", "tvSeriesChannel"),
  tv_seasons: entitySubscription("tv_seasons", "tvSeasonsChannel"),
  tv_episodes: entitySubscription("tv_episodes", "tvEpisodesChannel"),
};

const workflowSubscription = <P>(route: MessageRoute<P>, queue: string) => ({
  ...subscription(route, queue),
  queueOptions: { channel: "workflowChannel" satisfies ChannelName },
  errorBehavior: MessageHandlerErrorBehavior.ACK,
});

/** A metadata workflow was created. */
export const START_WORKFLOW_SUBSCRIPTION = workflowSubscription(
  START_WORKFLOW_ROUTE,
  "metadataJob.workflow.trigger",
);

/** A batch job of a workflow finished. */
export const JOB_COMPLETION_SUBSCRIPTION = workflowSubscription(
  BATCH_JOB_COMPLETION_ROUTE,
  "metadataJob.workflow.jobNotification",
);
