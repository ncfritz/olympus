import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  EventPublishStatus,
  OutboxEvent,
  OutboxSummary,
} from "../../model/outbox";
import {
  OUTBOX_ENABLED,
  OUTBOX_STORE,
  type OutboxStore,
} from "../../store/outboxStore";
import { SyncConfigService } from "../../sync/services/SyncConfigService";
import {
  toDomainObject,
  toSourceSummary,
} from "../converters/OutboxEventConverter";

const DEFAULT_FAILED_LIMIT = 50;

/** The publish status: what the outbox holds, and requeueing what failed. */
@Injectable()
export class OutboxService {
  constructor(
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    @Inject(OUTBOX_ENABLED) private readonly outboxEnabled: boolean,
    private readonly syncConfig: SyncConfigService,
  ) {}

  /**
   * Backs the Publish page's per-calendar summary table. Every *configured*
   * calendar gets a row, zero-filled if it has no outbox activity yet —
   * otherwise a calendar that's never been published (exactly the case
   * backfill exists for) would have no row to trigger it from. A source
   * with outbox activity but no matching configured calendar (removed from
   * sync after publishing something) still gets a row too, just without a
   * calendarId to backfill — dropping it would hide a stuck failure just
   * because its calendar is gone.
   */
  async getSummary(): Promise<OutboxSummary> {
    const [stats, calendars] = await Promise.all([
      this.outbox.getStats(),
      this.syncConfig.getAll(),
    ]);
    const calendarIdBySource = new Map(
      calendars.map((c) => [c.source, c.calendarId]),
    );
    const zeroStats = { pending: 0, sent: 0, failed: 0, oldestPendingAt: null };

    const sources = new Map(
      calendars.map((c) => [
        c.source,
        toSourceSummary({ ...zeroStats, source: c.source }, c.calendarId),
      ]),
    );
    for (const s of stats) {
      sources.set(
        s.source,
        toSourceSummary(s, calendarIdBySource.get(s.source)),
      );
    }

    return { enabled: this.outboxEnabled, sources: [...sources.values()] };
  }

  async listFailed(limit = DEFAULT_FAILED_LIMIT): Promise<OutboxEvent[]> {
    const records = await this.outbox.listFailed(limit);
    return records.map(toDomainObject);
  }

  /** Puts a failed outbox event back in line; the dispatcher retries it on its next tick. */
  async requeue(outboxEventId: string): Promise<void> {
    if (!(await this.outbox.requeue(outboxEventId))) {
      throw new NotFoundException(
        `Failed outbox event with id ${outboxEventId} not found`,
      );
    }
  }

  /** Backs the "Publish status" row in the event detail drawer. */
  async getEventPublishStatus(eventId: string): Promise<EventPublishStatus> {
    const latest = await this.outbox.getLatestForEvent(eventId);
    return {
      enabled: this.outboxEnabled,
      latest: latest ? toDomainObject(latest) : undefined,
    };
  }
}
