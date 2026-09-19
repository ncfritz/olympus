import type { MetadataFetchJobStatus } from "@ncfritz/olympus-sdk/dionysus";

/** Fetch job statuses nothing is pending on. */
export const TERMINAL_STATUSES: MetadataFetchJobStatus[] = [
  "failed",
  "invalidated",
  "fetched",
  "cancelled",
];
