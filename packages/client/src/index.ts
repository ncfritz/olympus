export * from "./clients";
export * from "./dionysus/ContentApi";
export * from "./dionysus/JobApi";
export * from "./dionysus/MediaApi";
export * from "./dionysus/MediaSearchApi";
export * from "./dionysus/MetadataApi";
export * from "./dionysus/MetadataWorkflowApi";
export * from "./filters";
export * from "./olympus/NotificationApi";

import { ContentApi } from "./dionysus/ContentApi";
import { JobApi } from "./dionysus/JobApi";
import { MediaApi } from "./dionysus/MediaApi";
import { MediaSearchApi } from "./dionysus/MediaSearchApi";
import { MetadataApi } from "./dionysus/MetadataApi";
import { MetadataWorkflowApi } from "./dionysus/MetadataWorkflowApi";
import { NotificationApi } from "./olympus/NotificationApi";

/** Every wrapper; each is constructed with the OlympusClients. */
export const OLYMPUS_APIS = [
  ContentApi,
  JobApi,
  MediaApi,
  MediaSearchApi,
  MetadataApi,
  MetadataWorkflowApi,
  NotificationApi,
] as const;
