import { BatchJobApiModule } from "../module/BatchJobApiModule";
import { ContentApiModule } from "../module/ContentApiModule";
import { MediaApiModule } from "../module/MediaApiModule";
import { MeetingApiModule } from "../module/MeetingApiModule";
import { MetadataApiModule } from "../module/MetadataApiModule";
import { NotesApiModule } from "../module/NotesApiModule";
import { NotificationsApiModule } from "../module/NotificationsApiModule";
import { WorkflowApiModule } from "../module/WorkflowApiModule";
import { Routes } from "../utils/routes";
import { OpenApiDocumentConfig } from "./documentBuilder";

export const OlympusApiConfig: OpenApiDocumentConfig = {
  name: "Olympus",
  route: Routes.OLYMPUS,
  modules: [NotificationsApiModule],
};

export const DionysusApiConfig: OpenApiDocumentConfig = {
  name: "Dionysus",
  route: Routes.DIONYSUS,
  modules: [
    BatchJobApiModule,
    ContentApiModule,
    MediaApiModule,
    MetadataApiModule,
    WorkflowApiModule,
  ],
};

export const MinervaApiConfig: OpenApiDocumentConfig = {
  name: "Minerva",
  route: Routes.MINERVA,
  modules: [NotesApiModule, MeetingApiModule],
};
