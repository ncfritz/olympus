import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import moment from "moment";
import { CalendarAuthService } from "../../calendarAuth/services/CalendarAuthService";
import type { CanonicalCalendarEvent } from "../../domain/canonicalEvent";
import type {
  BaseCalendar,
  Calendar,
  CalendarBackfill,
  PartialCalendar,
} from "../../model/calendars";
import {
  CALENDAR_BUSY_INCLUSION_STORE,
  type CalendarBusyInclusionStore,
} from "../../store/calendarBusyInclusionStore";
import {
  CALENDAR_ENABLEMENT_STORE,
  type CalendarEnablementStore,
} from "../../store/calendarEnablementStore";
import { EVENT_STORE, type EventStore } from "../../store/eventStore";
import {
  OUTBOX_ENABLED,
  OUTBOX_STORE,
  type OutboxStore,
} from "../../store/outboxStore";
import { SyncConfigService } from "../../sync/services/SyncConfigService";
import { SyncEngine } from "../../sync/services/SyncEngine";
import type { SyncedCalendarConfig } from "../../sync/syncedCalendarConfig";

// Pragmatic cap on one backfill request, same reasoning (and same order of
// magnitude) as SyncEngine's FULL_SYNC_DIFF_LIMIT: fine for a personal/
// small-team calendar, would need real pagination well beyond this scale.
const BACKFILL_LIMIT = 10_000;
const BACKFILL_PAGE_SIZE = 500;

/** The synced calendars: which exist, their settings and status. */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly config: SyncConfigService,
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(CALENDAR_ENABLEMENT_STORE)
    private readonly enablement: CalendarEnablementStore,
    @Inject(CALENDAR_BUSY_INCLUSION_STORE)
    private readonly busyInclusion: CalendarBusyInclusionStore,
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    @Inject(OUTBOX_ENABLED) private readonly outboxEnabled: boolean,
    private readonly engine: SyncEngine,
    private readonly calendarAuth: CalendarAuthService,
  ) {}

  async list(): Promise<Calendar[]> {
    const [calendars, enabledOverrides, busyOverrides] = await Promise.all([
      this.config.getAll(),
      this.enablement.listOverrides(),
      this.busyInclusion.listOverrides(),
    ]);
    return Promise.all(
      calendars.map((calendar) =>
        this.status(calendar, enabledOverrides, busyOverrides),
      ),
    );
  }

  /** Adds a calendar of a connected account; its first sync runs in the background. */
  async create(base: BaseCalendar): Promise<Calendar> {
    if (!this.calendarAuth.isConnected(base.accountLabel, base.provider)) {
      throw new NotFoundException(
        `Account "${base.accountLabel}" (${base.provider}) isn't connected yet`,
      );
    }

    const calendar: SyncedCalendarConfig = { ...base, enablePush: false };
    await this.config.add(calendar);

    // Fire-and-forget: don't make the caller wait out a potentially slow
    // full sync just to see the calendar appear.
    this.syncInBackground(calendar, "Initial sync failed for newly added");

    return {
      ...calendar,
      synced: false,
      enabled: true,
      includedInBusy: true,
      syncing: this.engine.isSyncing(calendar.calendarId),
    };
  }

  async update(
    calendarId: string,
    changes: PartialCalendar,
  ): Promise<Calendar> {
    const calendar = await this.findConfigured(calendarId);
    if (changes.enabled !== undefined) {
      await this.enablement.setEnabled(calendarId, changes.enabled);
    }
    if (changes.includedInBusy !== undefined) {
      await this.busyInclusion.setIncludedInBusy(
        calendarId,
        changes.includedInBusy,
      );
    }
    const [enabledOverrides, busyOverrides] = await Promise.all([
      this.enablement.listOverrides(),
      this.busyInclusion.listOverrides(),
    ]);
    return this.status(calendar, enabledOverrides, busyOverrides);
  }

  delete(calendarId: string): Promise<void> {
    return this.config.remove(calendarId);
  }

  /** Starts a sync of the calendar in the background. */
  async sync(calendarId: string): Promise<void> {
    const calendar = await this.findConfigured(calendarId);
    this.syncInBackground(calendar, "Manually triggered sync failed for");
  }

  /**
   * Re-queues this calendar's current, non-deleted events onto the outbound
   * broker as a "backfill" resend — for standing up a fresh downstream
   * database, or recovering one that fell too far behind for its own
   * retries to catch up. Synchronous: enqueuing is a handful of bulk
   * inserts, not a slow round trip to a calendar provider.
   */
  async backfill(calendarId: string): Promise<CalendarBackfill> {
    const calendar = await this.findConfigured(calendarId);
    if (!this.outboxEnabled) {
      throw new ConflictException(
        "Outbound sync isn't configured — set OUTBOX_ENABLED=true to enable it",
      );
    }

    let cursor: string | undefined;
    let enqueued = 0;

    while (enqueued < BACKFILL_LIMIT) {
      const page: CanonicalCalendarEvent[] = await this.store.listEvents({
        source: calendar.source,
        deleted: false,
        limit: BACKFILL_PAGE_SIZE,
        cursor,
      });
      if (page.length === 0) break;

      enqueued += await this.outbox.enqueueBackfill(calendar.source, page);
      cursor = page[page.length - 1].id;
      if (page.length < BACKFILL_PAGE_SIZE) break;
    }

    return { enqueued, truncated: enqueued >= BACKFILL_LIMIT };
  }

  private async status(
    calendar: SyncedCalendarConfig,
    enabledOverrides: Record<string, boolean>,
    busyOverrides: Record<string, boolean>,
  ): Promise<Calendar> {
    const state = await this.store.getSyncState(calendar.calendarId);
    return {
      ...calendar,
      synced: Boolean(state?.syncToken),
      enabled: enabledOverrides[calendar.calendarId] ?? true,
      includedInBusy: busyOverrides[calendar.calendarId] ?? true,
      lastSyncedAt: state?.lastSyncedAt
        ? moment.utc(state.lastSyncedAt)
        : undefined,
      syncing: this.engine.isSyncing(calendar.calendarId),
    };
  }

  private syncInBackground(calendar: SyncedCalendarConfig, what: string) {
    this.engine.syncOne(calendar, "manual").catch((error) => {
      this.logger.error(
        `${what} "${calendar.calendarId}": ${error instanceof Error ? error.message : error}`,
      );
    });
  }

  private async findConfigured(
    calendarId: string,
  ): Promise<SyncedCalendarConfig> {
    const calendar = (await this.config.getAll()).find(
      (c) => c.calendarId === calendarId,
    );
    if (!calendar) {
      throw new NotFoundException(`Calendar with id ${calendarId} not found`);
    }
    return calendar;
  }
}
