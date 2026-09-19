import {
  type MediaAssetType,
  SEARCH_FANOUT_ROUTE,
  searchExecutionRoute,
  subscription,
} from "@ncfritz/olympus-messages";

/**
 * RabbitMQ names this agent consumes and publishes. Exchanges, routing keys
 * and payloads come from the shared contract (@ncfritz/olympus-messages);
 * the queues are the agent's own.
 */
export {
  type InitiatingAsset,
  type MediaAssetType,
  SEARCH_FANOUT_ROUTE,
  type SearchExecutionMessage,
  searchExecutionRoute,
  type SearchFanoutMessage,
} from "@ncfritz/olympus-messages";

/** The queue of one asset type's searches, e.g. `search.execution.movie.trigger`. */
export const searchExecutionQueue = (assetType: MediaAssetType) =>
  `search.execution.${assetType}.trigger`;

const searchSubscription = (assetType: MediaAssetType) =>
  subscription(
    searchExecutionRoute(assetType),
    searchExecutionQueue(assetType),
  );

/** @RabbitSubscribe options of the search handlers, by asset type. */
export const SEARCH_SUBSCRIPTIONS = {
  movie: searchSubscription("movie"),
  tv_series: searchSubscription("tv_series"),
  tv_season: searchSubscription("tv_season"),
  tv_episode: searchSubscription("tv_episode"),
} satisfies Record<MediaAssetType, unknown>;

/** @RabbitSubscribe options of the periodic fanout. */
export const FANOUT_SUBSCRIPTION = subscription(
  SEARCH_FANOUT_ROUTE,
  "search.fanout.trigger",
);
