import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SyncRunTrigger } from "../domain/sync-run";
import { PollingNotifier } from "./polling-notifier";
import { SyncConfigService } from "./sync-config.service";
import { SyncEngine } from "./sync-engine";
import { WebhookNotifier } from "./webhook-notifier";

/**
 * Starts the ChangeNotifier(s) at boot and routes their signals into
 * SyncEngine — unconditionally, even with nothing configured yet, since a
 * calendar can be added later through the Sync page's discovery UI and
 * polling needs to already be running to pick it up.
 */
@Injectable()
export class SyncBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncBootstrapService.name);

  constructor(
    private readonly engine: SyncEngine,
    private readonly config: SyncConfigService,
    private readonly polling: PollingNotifier,
    private readonly webhook: WebhookNotifier,
  ) {}

  async onModuleInit(): Promise<void> {
    if ((await this.config.getAll()).length === 0) {
      this.logger.warn("No calendars configured yet — nothing to sync until one is added");
    }

    const onChange = async (calendarId: string, trigger: SyncRunTrigger) => {
      const calendar = (await this.config.getAll()).find((c) => c.calendarId === calendarId);
      if (!calendar) return;

      await this.engine.syncOne(calendar, trigger).catch((error) => {
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
