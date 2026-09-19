import { DynamicModule, Module, Type } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RabbitModule } from "../infra/RabbitModule";
import { DownloadUpdateHandler } from "./handlers/DownloadUpdateHandler";
import { StartDownloadHandler } from "./handlers/StartDownloadHandler";
import { DownloadStatusPoller } from "./services/DownloadStatusPoller";
import { NzbGeekClient } from "./services/NzbGeekClient";
import { NzbGetClient } from "./services/NzbGetClient";

/** The download handlers and status poller, by their DISABLE_ switch. */
export const DOWNLOAD_HANDLERS = {
  DISABLE_DIONYSUS_START_DOWNLOAD_HANDLER: StartDownloadHandler,
  DISABLE_DIONYSUS_DOWNLOAD_UPDATE_HANDLER: DownloadUpdateHandler,
  DISABLE_DIONYSUS_DOWNLOAD_STATUS_HANDLER: DownloadStatusPoller,
};

/** Usenet downloads: NZBGeek for NZBs, NZBGet to download them. */
@Module({})
export class DownloadsModule {
  /** @param handlers the enabled DOWNLOAD_HANDLERS */
  static register(handlers: Type[]): DynamicModule {
    return {
      module: DownloadsModule,
      imports: [ScheduleModule.forRoot(), RabbitModule],
      providers: [NzbGeekClient, NzbGetClient, ...handlers],
    };
  }
}
