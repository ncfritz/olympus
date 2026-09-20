import { Inject, Injectable, Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { ChangeNotifier } from "../changeNotifier";
import { syncConfig, type SyncConfigType } from "../../config/configuration";
import { SyncConfigService } from "./SyncConfigService";

const TIMER_NAME = "poll:all";

/**
 * No infrastructure required — this is the default/fallback notifier for
 * every calendar, even once push is added later, since push delivery is
 * never fully guaranteed.
 *
 * One timer for every configured calendar, re-reading SyncConfigService on
 * every tick rather than snapshotting the list at `start()` — that's what
 * lets a calendar added later (through the Sync page's discovery UI) start
 * getting polled without a restart.
 */
@Injectable()
export class PollingNotifier implements ChangeNotifier {
  private readonly logger = new Logger(PollingNotifier.name);
  private readonly intervalMs: number;

  constructor(
    private readonly config: SyncConfigService,
    private readonly scheduler: SchedulerRegistry,
    @Inject(syncConfig.KEY) sync: SyncConfigType,
  ) {
    this.intervalMs = sync.pollIntervalMs;
  }

  start(onChange: (calendarId: string, trigger: "poll") => void): void {
    const tick = async () => {
      for (const calendar of await this.config.getAll()) {
        onChange(calendar.calendarId, "poll");
      }
    };

    const timer = setInterval(() => {
      tick().catch((error) =>
        this.logger.error(
          `Poll tick failed: ${error instanceof Error ? error.message : error}`,
        ),
      );
    }, this.intervalMs);
    this.scheduler.addInterval(TIMER_NAME, timer);

    // Fire once immediately rather than waiting for the first tick.
    tick().catch((error) =>
      this.logger.error(
        `Initial poll failed: ${error instanceof Error ? error.message : error}`,
      ),
    );
  }

  stop(): void {
    if (this.scheduler.doesExist("interval", TIMER_NAME)) {
      this.scheduler.deleteInterval(TIMER_NAME);
    }
  }
}
