import moment from "moment";
import type { CanonicalCalendarEvent } from "../../domain/canonicalEvent";
import type { Event } from "../../model/events";

/** A stored event as the management API returns it. */
export const toDomainObject = (event: CanonicalCalendarEvent): Event => ({
  id: event.id,
  subject: event.subject,
  sensitivity: event.sensitivity,
  importance: event.importance,
  occurrenceType: event.occurrenceType,
  type: event.type,
  reminder: event.reminder,
  response: event.response,
  startTime: moment.utc(event.startTime),
  endTime: moment.utc(event.endTime),
  duration: event.duration,
  allDay: event.allDay,
  status: event.status,
  location: event.location ?? undefined,
  cancelled: event.cancelled,
  organizerEmail: event.organizerEmail ?? undefined,
  deleted: event.deleted,
  uid: event.uid,
  recurrenceId: event.recurrenceId ?? undefined,
  source: event.source,
  recurrenceRule: event.recurrenceRule ?? undefined,
});
