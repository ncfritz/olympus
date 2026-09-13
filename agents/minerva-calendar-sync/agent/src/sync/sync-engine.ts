import { Inject, Injectable, Logger } from "@nestjs/common";
import { CanonicalCalendarEvent, SyncState } from "../domain/canonical-event";
import { CalendarProvider, SyncTokenExpiredError } from "../providers/calendar-provider";
import { CalendarProviderRegistry } from "../providers/calendar-provider-registry";
import { EVENT_STORE, EventStore } from "../store/event-store";
import { SyncedCalendarConfig } from "./synced-calendar-config";

// Pragmatic cap for the full-sync deletion diff (see markVanishedEventsDeleted).
// Fine for a personal/small-team calendar; would need real pagination well beyond this scale.
const FULL_SYNC_DIFF_LIMIT = 10_000;

/**
 * Moves canonical events from a CalendarProvider into an EventStore. Knows
 * about neither Google nor SQL — everything provider- or store-specific is
 * behind those two interfaces.
 */
@Injectable()
export class SyncEngine {
  private readonly logger = new Logger(SyncEngine.name);
  private readonly inFlight = new Set<string>();

  constructor(
    @Inject(EVENT_STORE) private readonly store: EventStore,
    private readonly providers: CalendarProviderRegistry,
  ) {}

  /**
   * Syncs one configured calendar. Safe to call from multiple trigger
   * sources (poll timer, push webhook) — an overlapping call for the same
   * calendarId is skipped rather than run concurrently.
   */
  async syncOne(config: SyncedCalendarConfig): Promise<void> {
    if (this.inFlight.has(config.calendarId)) {
      this.logger.debug(`Skipping sync for "${config.calendarId}" — already in progress`);
      return;
    }

    this.inFlight.add(config.calendarId);
    try {
      await this.runSync(config);
    } finally {
      this.inFlight.delete(config.calendarId);
    }
  }

  private async runSync(config: SyncedCalendarConfig): Promise<void> {
    const provider = this.providers.resolve(config);
    const state = await this.store.getSyncState(config.calendarId);

    if (!state?.syncToken) {
      await this.runFullSync(provider, config);
      return;
    }

    try {
      await this.runIncrementalSync(provider, config, state);
    } catch (error) {
      if (error instanceof SyncTokenExpiredError) {
        this.logger.warn(`Sync token expired for "${config.calendarId}" — falling back to a full sync`);
        await this.runFullSync(provider, config);
        return;
      }
      throw error;
    }
  }

  private async runFullSync(provider: CalendarProvider, config: SyncedCalendarConfig): Promise<void> {
    const seenUids = new Set<string>();
    let nextSyncToken: string | undefined;

    for await (const batch of provider.fullSync(config.calendarId)) {
      for (const raw of batch.events) {
        const canonical = this.normalizeForStorage(provider, raw, config);
        if (!canonical) continue;
        seenUids.add(canonical.uid);
        await this.store.upsertEvent(canonical);
      }
      nextSyncToken = batch.nextSyncToken ?? nextSyncToken;
    }

    await this.markVanishedEventsDeleted(config, seenUids);

    if (!nextSyncToken) {
      this.logger.warn(
        `Full sync of "${config.calendarId}" did not yield a sync token — will full-sync again next run`,
      );
      return;
    }

    await this.store.saveSyncState(config.calendarId, {
      calendarId: config.calendarId,
      syncToken: nextSyncToken,
      channelId: null,
      resourceId: null,
      channelExpiration: null,
    });

    this.logger.log(`Full sync of "${config.calendarId}" complete: ${seenUids.size} events`);
  }

  private async runIncrementalSync(
    provider: CalendarProvider,
    config: SyncedCalendarConfig,
    state: SyncState,
  ): Promise<void> {
    const result = await provider.incrementalSync(config.calendarId, state.syncToken!);

    for (const raw of result.events) {
      if (provider.isRemoval(raw)) {
        const removal = provider.resolveRemoval(raw);
        if (removal.isOccurrence) {
          await this.store.markCancelled(config.source, removal.uid);
        } else {
          await this.store.markDeleted(config.source, removal.uid);
        }
        continue;
      }

      const canonical = this.normalizeForStorage(provider, raw, config);
      if (canonical) await this.store.upsertEvent(canonical);
    }

    await this.store.saveSyncState(config.calendarId, { ...state, syncToken: result.nextSyncToken });

    if (result.events.length > 0) {
      this.logger.log(`Incremental sync of "${config.calendarId}" applied ${result.events.length} change(s)`);
    }
  }

  /**
   * A fully-populated cancelled event can in principle appear on a full sync
   * too — apply the same occurrence-vs-removal split used for the minimal
   * incremental removal path (see runIncrementalSync).
   *
   * Real calendars accumulate malformed/legacy events that fail to
   * normalize (missing fields Google itself can't explain) — one such event
   * is logged and skipped rather than aborting the sync of everything else.
   */
  private normalizeForStorage(
    provider: CalendarProvider,
    raw: unknown,
    config: SyncedCalendarConfig,
  ): CanonicalCalendarEvent | null {
    let canonical: CanonicalCalendarEvent;
    try {
      canonical = provider.normalizeEvent(raw, { source: config.source });
    } catch (error) {
      this.logger.warn(
        `Skipping an event on "${config.calendarId}" that failed to normalize: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }

    if (!canonical.cancelled) return canonical;
    return canonical.recurrenceId ? canonical : { ...canonical, deleted: true };
  }

  private async markVanishedEventsDeleted(
    config: SyncedCalendarConfig,
    seenUids: Set<string>,
  ): Promise<void> {
    const existing = await this.store.listEvents({
      source: config.source,
      deleted: false,
      limit: FULL_SYNC_DIFF_LIMIT,
    });

    for (const event of existing) {
      if (!seenUids.has(event.uid)) {
        await this.store.markDeleted(event.source, event.uid);
      }
    }
  }
}
