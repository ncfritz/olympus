import { Counter } from "prom-client";

/**
 * How the weather caches answered (ADR 0024): `hit` served from the cache,
 * `miss` fetched, `stale` served the last good value while the provider
 * failed, `error` had nothing to serve.
 */
const cacheRequests = new Counter({
  name: "weather_cache_requests_total",
  help: "Weather cache lookups, by cache and result",
  labelNames: ["cache", "result"],
});

export type CacheResult = "hit" | "miss" | "stale" | "error";

export const recordCacheRequest = (
  cache: string,
  result: CacheResult,
): void => {
  cacheRequests.inc({ cache, result });
};
