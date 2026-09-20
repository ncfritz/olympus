import { AvailabilityStatus, EventOverride } from "../domain/availability";

/**
 * Per-meeting status overrides, keyed by canonical event id rather than a
 * foreign key into the Event table — see EventOverride's doc comment for
 * why: this must outlive a full wipe-and-re-sync of Event.
 */
export interface EventOverrideStore {
  setOverride(
    eventId: string,
    status: AvailabilityStatus,
  ): Promise<EventOverride>;
  clearOverride(eventId: string): Promise<void>;
  getOverride(eventId: string): Promise<EventOverride | null>;
  listOverrides(eventIds: string[]): Promise<EventOverride[]>;
}

/** Nest DI token — inject with `@Inject(EVENT_OVERRIDE_STORE)`. */
export const EVENT_OVERRIDE_STORE = Symbol("EVENT_OVERRIDE_STORE");
