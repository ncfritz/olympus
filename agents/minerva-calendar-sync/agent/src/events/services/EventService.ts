import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Event, ListEventsQuery } from "../../model/events";
import { EVENT_STORE, type EventStore } from "../../store/eventStore";
import { toDomainObject } from "../converters/EventConverter";

/** The synced events. */
@Injectable()
export class EventService {
  constructor(@Inject(EVENT_STORE) private readonly store: EventStore) {}

  async list(query: ListEventsQuery): Promise<Event[]> {
    const events = await this.store.listEvents(query);
    return events.map(toDomainObject);
  }

  async describe(eventId: string): Promise<Event> {
    const event = await this.store.getEventById(eventId);
    if (!event) {
      throw new NotFoundException(`Event with id ${eventId} not found`);
    }
    return toDomainObject(event);
  }
}
