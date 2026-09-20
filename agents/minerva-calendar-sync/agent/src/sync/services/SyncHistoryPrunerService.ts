import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { SYNC_RUN_STORE, SyncRunStore } from "../../store/syncRunStore";

const DEFAULT_RETENTION_DAYS = 90;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TIMER_NAME = "sync-history-prune";

/**
 * Keeps the SyncRun table bounded by age — runs older than
 * SYNC_HISTORY_RETENTION_DAYS are deleted (cascading to their event
 * changes) once a day. "Meaningful runs only" (see SyncEngine) already
 * keeps growth tied to real activity rather than the ~45s poll interval,
 * so this is a backstop rather than the primary defense against unbounded
 * growth.
 */
@Injectable()
export class SyncHistoryPrunerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncHistoryPrunerService.name);
  private readonly retentionDays: number;

  constructor(
    @Inject(SYNC_RUN_STORE) private readonly syncRuns: SyncRunStore,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService,
  ) {
    this.retentionDays =
      Number(config.get<string>("SYNC_HISTORY_RETENTION_DAYS")) ||
      DEFAULT_RETENTION_DAYS;
  }

  onModuleInit(): void {
    const timer = setInterval(() => {
      this.prune().catch((error) =>
        this.logger.error(
          `Prune failed: ${error instanceof Error ? error.message : error}`,
        ),
      );
    }, PRUNE_INTERVAL_MS);
    this.scheduler.addInterval(TIMER_NAME, timer);

    // Run once at boot rather than waiting a full day for the first pass.
    this.prune().catch((error) =>
      this.logger.error(
        `Initial prune failed: ${error instanceof Error ? error.message : error}`,
      ),
    );
  }

  onModuleDestroy(): void {
    if (this.scheduler.doesExist("interval", TIMER_NAME)) {
      this.scheduler.deleteInterval(TIMER_NAME);
    }
  }

  private async prune(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    const count = await this.syncRuns.pruneFinishedBefore(cutoff);
    if (count > 0) {
      this.logger.log(
        `Pruned ${count} sync history run(s) older than ${this.retentionDays} day(s)`,
      );
    }
  }
}
