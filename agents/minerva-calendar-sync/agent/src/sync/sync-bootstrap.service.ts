import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PollingNotifier } from "./polling-notifier";
import { SyncConfigService } from "./sync-config.service";
import { SyncEngine } from "./sync-engine";
import { WebhookNotifier } from "./webhook-notifier";

/** Starts the configured ChangeNotifier(s) at boot and routes their signals into SyncEngine. */
@Injectable()
export class SyncBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncBootstrapService.name);

  constructor(
    private readonly engine: SyncEngine,
    private readonly config: SyncConfigService,
    private readonly polling: PollingNotifier,
    private readonly webhook: WebhookNotifier,
  ) {}

  onModuleInit(): void {
    if (this.config.getAll().length === 0) {
      this.logger.warn("No calendars configured (SYNCED_CALENDARS is empty) — nothing to sync");
      return;
    }

    const onChange = (calendarId: string) => {
      const calendar = this.config.getAll().find((c) => c.calendarId === calendarId);
      if (!calendar) return;

      this.engine.syncOne(calendar).catch((error) => {
        this.logger.error(`Sync failed for "${calendarId}": ${error instanceof Error ? error.message : error}`);
      });
    };

    this.polling.start(onChange);
    this.webhook.start(onChange);
  }

  onModuleDestroy(): void {
    this.polling.stop();
    this.webhook.stop();
  }
}
