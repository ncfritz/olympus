import { Inject, Injectable, Logger } from "@nestjs/common";
import { buildCanonicalEventId, CanonicalCalendarEvent, SyncState } from "../domain/canonical-event";
import { NewSyncRun, SyncRunEventChange, SyncRunTrigger, SyncRunType } from "../domain/sync-run";
import { CalendarProvider, SyncTokenExpiredError } from "../providers/calendar-provider";
import { CalendarProviderRegistry } from "../providers/calendar-provider-registry";
import { CALENDAR_ENABLEMENT_STORE, CalendarEnablementStore } from "../store/calendar-enablement-store";
import { EVENT_STORE, EventStore, UpsertResult } from "../store/event-store";
import { SYNC_RUN_STORE, SyncRunStore } from "../store/sync-run-store";
import { SyncedCalendarConfig } from "./synced-calendar-config";

// Pragmatic cap for the full-sync deletion diff (see markVanishedEventsDeleted).
// Fine for a personal/small-team calendar; would need real pagination well beyond this scale.
const FULL_SYNC_DIFF_LIMIT = 10_000;

/** Running counters + the individual event changes for one in-progress sync, built up as it goes and persisted at the end. */
interface SyncTally {
  total: number;
  added: number;
  updated: number;
  deleted: number;
  changes: SyncRunEventChange[];
}

function newTally(): SyncTally {
  return { total: 0, added: 0, updated: 0, deleted: 0, changes: [] };
}

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
    @Inject(CALENDAR_ENABLEMENT_STORE) private readonly enablement: CalendarEnablementStore,
    private readonly providers: CalendarProviderRegistry,
    @Inject(SYNC_RUN_STORE) private readonly syncRuns: SyncRunStore,
  ) {}

  /**
   * Syncs one configured calendar. Safe to call from multiple trigger
   * sources (poll timer, push webhook, the manual "Sync now" button) — an
   * overlapping call for the same calendarId is skipped rather than run
   * concurrently, and a calendar the user has disabled is skipped outright.
   *
   * `trigger` is recorded on the resulting sync-history entry (if any) —
   * see persistRun for which runs are actually worth recording. Required
   * rather than defaulted: a caller that silently defaulted here once
   * mislabeled real poll-triggered runs as "manual" in the history table.
   */
  async syncOne(config: SyncedCalendarConfig, trigger: SyncRunTrigger): Promise<void> {
    // The has-check and add below must stay adjacent with no `await` between
    // them — that's what makes two near-simultaneous calls mutually
    // exclusive (see the concurrency test). The enablement check is async,
    // so it has to live inside the guarded section instead of before it.
    if (this.inFlight.has(config.calendarId)) {
      this.logger.debug(`Skipping sync for "${config.calendarId}" — already in progress`);
      return;
    }

    this.inFlight.add(config.calendarId);
    try {
      const overrides = await this.enablement.listOverrides();
      if (overrides[config.calendarId] === false) {
        this.logger.debug(`Skipping sync for "${config.calendarId}" — disabled`);
        return;
      }
      await this.runSyncAndRecord(config, trigger);
    } finally {
      this.inFlight.delete(config.calendarId);
    }
  }

  /** Whether `calendarId` has a sync in progress right now, from any trigger source — drives the frontend's "syncing" indicator. */
  isSyncing(calendarId: string): boolean {
    return this.inFlight.has(calendarId);
  }

  private async runSyncAndRecord(config: SyncedCalendarConfig, trigger: SyncRunTrigger): Promise<void> {
    const startedAt = new Date();
    const tally = newTally();
    let type: SyncRunType = "incremental";

    try {
      type = await this.runSync(config, tally);
      await this.persistRun(config, trigger, type, "success", startedAt, tally, null);
    } catch (error) {
      await this.persistRun(
        config,
        trigger,
        type,
        "error",
        startedAt,
        tally,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Every attempt against the provider gets a history entry — poll and
   * push ticks included, even when they turn out to be no-ops, so the Sync
   * page can show that background syncing is actually running rather than
   * only ever showing manual clicks. The Sync page's type/trigger/status
   * filters (and SyncHistoryPrunerService's retention window) are how that
   * volume stays manageable, not a write-time skip here.
   */
  private async persistRun(
    config: SyncedCalendarConfig,
    trigger: SyncRunTrigger,
    type: SyncRunType,
    status: "success" | "error",
    startedAt: Date,
    tally: SyncTally,
    errorMessage: string | null,
  ): Promise<void> {
    const run: NewSyncRun = {
      calendarId: config.calendarId,
      source: config.source,
      type,
      trigger,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      totalCount: tally.total,
      addedCount: tally.added,
      updatedCount: tally.updated,
      deletedCount: tally.deleted,
      errorMessage,
      changes: tally.changes,
    };

    try {
      await this.syncRuns.create(run);
    } catch (error) {
      this.logger.error(
        `Failed to persist sync history for "${config.calendarId}": ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async runSync(config: SyncedCalendarConfig, tally: SyncTally): Promise<SyncRunType> {
    const provider = this.providers.resolve(config);
    const state = await this.store.getSyncState(config.calendarId);

    if (!state?.syncToken) {
      await this.runFullSync(provider, config, state, tally);
      return "full";
    }

    try {
      await this.runIncrementalSync(provider, config, state, tally);
      return "incremental";
    } catch (error) {
      if (error instanceof SyncTokenExpiredError) {
        this.logger.warn(`Sync token expired for "${config.calendarId}" — falling back to a full sync`);
        await this.runFullSync(provider, config, state, tally);
        return "full";
      }
      throw error;
    }
  }

  private async runFullSync(
    provider: CalendarProvider,
    config: SyncedCalendarConfig,
    existingState: SyncState | null,
    tally: SyncTally,
  ): Promise<void> {
    const seenUids = new Set<string>();
    let nextSyncToken: string | undefined;

    for await (const batch of provider.fullSync(config.calendarId)) {
      for (const raw of batch.events) {
        const canonical = this.normalizeForStorage(provider, raw, config);
        if (!canonical) continue;
        seenUids.add(canonical.uid);
        tally.total += 1;
        const result = await this.store.upsertEvent(canonical);
        this.recordUpsert(tally, result, canonical);
      }
      nextSyncToken = batch.nextSyncToken ?? nextSyncToken;
    }

    await this.markVanishedEventsDeleted(config, seenUids, tally);

    if (!nextSyncToken) {
      this.logger.warn(
        `Full sync of "${config.calendarId}" did not yield a sync token — will full-sync again next run`,
      );
      return;
    }

    // A push channel (if any) is unaffected by a full resync — e.g. this can
    // run because the incremental sync token expired while a channel is
    // still perfectly valid, so its bookkeeping is carried over rather than
    // wiped.
    await this.store.saveSyncState(config.calendarId, {
      calendarId: config.calendarId,
      syncToken: nextSyncToken,
      channelId: existingState?.channelId ?? null,
      resourceId: existingState?.resourceId ?? null,
      channelExpiration: existingState?.channelExpiration ?? null,
      channelToken: existingState?.channelToken ?? null,
    });

    this.logger.log(`Full sync of "${config.calendarId}" complete: ${seenUids.size} events`);
  }

  private async runIncrementalSync(
    provider: CalendarProvider,
    config: SyncedCalendarConfig,
    state: SyncState,
    tally: SyncTally,
  ): Promise<void> {
    const result = await provider.incrementalSync(config.calendarId, state.syncToken!);

    for (const raw of result.events) {
      tally.total += 1;

      if (provider.isRemoval(raw)) {
        const removal = provider.resolveRemoval(raw);
        if (removal.isOccurrence) {
          const changed = await this.store.markCancelled(config.source, removal.uid);
          if (changed) await this.recordRemoval(tally, "updated", config.source, removal.uid);
        } else {
          const changed = await this.store.markDeleted(config.source, removal.uid);
          if (changed) await this.recordRemoval(tally, "deleted", config.source, removal.uid);
        }
        continue;
      }

      const canonical = this.normalizeForStorage(provider, raw, config);
      if (canonical) {
        const upsertResult = await this.store.upsertEvent(canonical);
        this.recordUpsert(tally, upsertResult, canonical);
      }
    }

    await this.store.saveSyncState(config.calendarId, { ...state, syncToken: result.nextSyncToken });

    if (result.events.length > 0) {
      this.logger.log(`Incremental sync of "${config.calendarId}" applied ${result.events.length} change(s)`);
    }
  }

  private recordUpsert(tally: SyncTally, result: UpsertResult, event: CanonicalCalendarEvent): void {
    if (result === "unchanged") return;
    if (result === "created") {
      tally.added += 1;
    } else {
      tally.updated += 1;
    }
    tally.changes.push({
      action: result === "created" ? "added" : "updated",
      eventId: event.id,
      subject: event.subject,
      startTime: event.startTime,
    });
  }

  /** The row is a soft cancel/delete, so it's still readable right after the mark for the subject/startTime the history entry wants. */
  private async recordRemoval(
    tally: SyncTally,
    action: "updated" | "deleted",
    source: string,
    uid: string,
  ): Promise<void> {
    if (action === "deleted") tally.deleted += 1;
    else tally.updated += 1;

    const event = await this.store.getEvent(source, uid);
    tally.changes.push({
      action,
      eventId: event?.id ?? buildCanonicalEventId(source, uid),
      subject: event?.subject ?? uid,
      startTime: event?.startTime ?? null,
    });
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
    tally: SyncTally,
  ): Promise<void> {
    const existing = await this.store.listEvents({
      source: config.source,
      deleted: false,
      limit: FULL_SYNC_DIFF_LIMIT,
    });

    for (const event of existing) {
      if (seenUids.has(event.uid)) continue;

      const changed = await this.store.markDeleted(event.source, event.uid);
      if (changed) {
        tally.deleted += 1;
        tally.changes.push({
          action: "deleted",
          eventId: event.id,
          subject: event.subject,
          startTime: event.startTime,
        });
      }
    }
  }
}
