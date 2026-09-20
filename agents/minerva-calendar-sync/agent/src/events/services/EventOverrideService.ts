import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AvailabilityStatus } from "../../domain/availability";
import type { EventOverride } from "../../model/events";
import {
  EVENT_OVERRIDE_STORE,
  type EventOverrideStore,
} from "../../store/eventOverrideStore";
import { EventService } from "./EventService";

/**
 * Per-event availability overrides, keyed by the event's canonical id so
 * they survive the event being wiped and re-synced.
 */
@Injectable()
export class EventOverrideService {
  constructor(
    @Inject(EVENT_OVERRIDE_STORE)
    private readonly store: EventOverrideStore,
    private readonly events: EventService,
  ) {}

  /**
   * The overrides of those events that have one, for a whole page of events
   * in one request.
   * @param ids comma-separated event IDs
   */
  list(ids: string): Promise<EventOverride[]> {
    return this.store.listOverrides(
      ids
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  async describe(eventId: string): Promise<EventOverride> {
    await this.events.describe(eventId);
    const override = await this.store.getOverride(eventId);
    if (!override) {
      throw new NotFoundException(
        `Event override for event with id ${eventId} not found`,
      );
    }
    return override;
  }

  async update(
    eventId: string,
    status: AvailabilityStatus,
  ): Promise<EventOverride> {
    await this.events.describe(eventId);
    return this.store.setOverride(eventId, status);
  }

  async delete(eventId: string): Promise<void> {
    await this.events.describe(eventId);
    await this.store.clearOverride(eventId);
  }
}
