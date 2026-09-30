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

/**
 * Station pushes by outcome: `stored`, `duplicate` (a repeat of one already
 * stored), `refused_address` (from outside the allowed ranges),
 * `refused_station` (an unregistered MAC), `invalid` (no usable PASSKEY or
 * time).
 */
const stationReports = new Counter({
  name: "weather_station_reports_total",
  help: "Weather station pushes, by outcome",
  labelNames: ["result"],
});

export type StationReportResult =
  "stored" | "duplicate" | "refused_address" | "refused_station" | "invalid";

export const recordStationReport = (result: StationReportResult): void => {
  stationReports.inc({ result });
};

/** The raw archive's writes and day seals, by outcome. */
const archive = new Counter({
  name: "weather_archive_operations_total",
  help: "Weather archive writes and seals, by outcome",
  labelNames: ["result"],
});

export const recordArchive = (
  result: "written" | "failed" | "sealed" | "seal_failed",
): void => {
  archive.inc({ result });
};
