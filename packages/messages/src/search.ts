import { delayedExchange, exchange, route } from "./routing";
import type { MediaAssetType } from "./values";

/**
 * Media searches: search the indexer for one asset (API, and the search
 * agents fanning out from series to seasons to episodes), and the periodic
 * fanout that triggers due search configurations.
 */

export const SEARCH_EXECUTION_TRIGGER_EXCHANGE = delayedExchange(
  "search.execution.trigger",
  "topic",
);
export const SEARCH_FANOUT_TRIGGER_EXCHANGE = exchange(
  "search.fanout.trigger",
  "fanout",
);

/** The search configuration a (fanned-out) search was started for. */
export interface InitiatingAsset {
  assetType: MediaAssetType;
  mediaId: number;
  /** TV seasons and episodes. */
  seriesId?: number;
  seasonNumber?: number;
  /** TV episodes. */
  episodeNumber?: number;
}

export interface SearchExecutionMessage {
  mediaId: number;
  /** Search children now instead of when they are due. */
  propagateImmediately?: boolean;
  initiatingAsset?: InitiatingAsset;
}

/** `jobType.<type>` → queue `search.execution.<type>.trigger` */
export const searchExecutionRoute = (assetType: MediaAssetType) =>
  route<SearchExecutionMessage>(
    SEARCH_EXECUTION_TRIGGER_EXCHANGE,
    `jobType.${assetType}`,
  );

export interface SearchFanoutMessage {
  /** How many due search configurations to trigger. */
  maxEntriesToProcess: number;
}

/** Fanout (no routing key) → queue `search.fanout.trigger` */
export const SEARCH_FANOUT_ROUTE = route<SearchFanoutMessage>(
  SEARCH_FANOUT_TRIGGER_EXCHANGE,
  "",
);
