import { CanonicalCalendarEvent } from "../domain/canonicalEvent";
import { OutboxRecord, OutboxSourceStats } from "../domain/outbox";

/**
 * Read/admin surface over the OutboxEvent table — everything the Publish
 * page and the calendar backfill action need. Writing a row on every Event
 * change is PrismaEventStore's job (see its enqueueOutbox), not this
 * interface's — that write has to happen inside the same transaction as the
 * Event row it describes, which a separate store can't participate in.
 * OutboxDispatcherService, which only ever claims/marks its own rows, talks
 * to Prisma directly rather than through here for the same reason this
 * isn't a full CRUD port: there's exactly one backend for it, unlike
 * EventStore.
 */
export interface OutboxStore {
  getStats(): Promise<OutboxSourceStats[]>;
  listFailed(limit: number): Promise<OutboxRecord[]>;
  getLatestForEvent(eventId: string): Promise<OutboxRecord | null>;
  /** Resets a failed row to pending (attempts/backoff cleared) so the dispatcher picks it up again. Returns whether it actually flipped a "failed" row. */
  requeue(id: string): Promise<boolean>;
  /** Bulk-enqueues a full-state resend of `events` (see the "backfill" action) for a calendar backfill. Returns how many rows were written. */
  enqueueBackfill(
    source: string,
    events: CanonicalCalendarEvent[],
  ): Promise<number>;
}

/** Nest DI token — inject with `@Inject(OUTBOX_STORE)`. */
export const OUTBOX_STORE = Symbol("OUTBOX_STORE");

/** Nest DI token for the `RABBITMQ_URL`-derived on/off switch — see StoreModule. Injected as a plain boolean (`@Inject(OUTBOX_ENABLED) outboxEnabled: boolean`) rather than read from ConfigService at each call site, so it's trivial to fake in tests without a full Nest config module. */
export const OUTBOX_ENABLED = Symbol("OUTBOX_ENABLED");
