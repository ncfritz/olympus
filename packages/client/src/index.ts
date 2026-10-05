export * from "./clients";
export * from "./dionysus/ContentApi";
export * from "./dionysus/JobApi";
export * from "./dionysus/MediaApi";
export * from "./dionysus/MediaSearchApi";
export * from "./dionysus/MetadataApi";
export * from "./dionysus/MetadataWorkflowApi";
export * from "./filters";
export * from "./minerva/MailApi";
export * from "./olympus/AuthApi";
export * from "./olympus/NotificationApi";
export * from "./olympus/WeatherApi";

import { ContentApi } from "./dionysus/ContentApi";
import { JobApi } from "./dionysus/JobApi";
import { MediaApi } from "./dionysus/MediaApi";
import { MediaSearchApi } from "./dionysus/MediaSearchApi";
import { MetadataApi } from "./dionysus/MetadataApi";
import { MetadataWorkflowApi } from "./dionysus/MetadataWorkflowApi";
import { MailApi } from "./minerva/MailApi";
import { AuthApi } from "./olympus/AuthApi";
import { NotificationApi } from "./olympus/NotificationApi";
import { WeatherApi } from "./olympus/WeatherApi";

/** Every wrapper; each is constructed with the OlympusClients. */
export const OLYMPUS_APIS = [
  AuthApi,
  ContentApi,
  JobApi,
  MailApi,
  MediaApi,
  MediaSearchApi,
  MetadataApi,
  MetadataWorkflowApi,
  NotificationApi,
  WeatherApi,
] as const;
