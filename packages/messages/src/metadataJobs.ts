import { delayedExchange, route } from "./routing";
import type { MetadataJobType } from "./values";

/** Fetch one metadata entity (API → metadata agents). */

export const METADATA_JOB_TRIGGER_EXCHANGE = delayedExchange(
  "metadataJob.trigger",
  "direct",
);

export interface MetadataJobMessage {
  /** The metadata fetch job id. */
  entityId: string;
  entityType: MetadataJobType;
  /** Re-fetch even if cached (default false). */
  bypassCache?: boolean;
}

/** `jobType.<type>` → queue `metadataJob.<type>.trigger` */
export const metadataJobRoute = (entityType: MetadataJobType) =>
  route<MetadataJobMessage>(
    METADATA_JOB_TRIGGER_EXCHANGE,
    `jobType.${entityType}`,
  );
