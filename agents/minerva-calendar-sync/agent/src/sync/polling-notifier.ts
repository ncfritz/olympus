import { Injectable } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { ChangeNotifier } from "./change-notifier";
import { SyncConfigService } from "./sync-config.service";

const DEFAULT_POLL_INTERVAL_MS = 45_000;

/**
 * No infrastructure required — this is the default/fallback notifier for
 * every calendar, even once push is added later, since push delivery is
 * never fully guaranteed.
 */
@Injectable()
export class PollingNotifier implements ChangeNotifier {
  private readonly intervalMs: number;
  private readonly intervalNames: string[] = [];

  constructor(
    private readonly config: SyncConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {
    this.intervalMs = Number(process.env.POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS;
  }

  start(onChange: (calendarId: string) => void): void {
    for (const calendar of this.config.getAll()) {
      const name = `poll:${calendar.calendarId}`;
      const timer = setInterval(() => onChange(calendar.calendarId), this.intervalMs);
      this.scheduler.addInterval(name, timer);
      this.intervalNames.push(name);
      // Fire once immediately rather than waiting for the first tick.
      onChange(calendar.calendarId);
    }
  }

  stop(): void {
    for (const name of this.intervalNames.splice(0)) {
      if (this.scheduler.doesExist("interval", name)) {
        this.scheduler.deleteInterval(name);
      }
    }
  }
}
