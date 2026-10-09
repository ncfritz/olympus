import type { CalendarEventMessage } from "@ncfritz/olympus-messages";

/** A calendar event as the sync agent publishes it, from a Google account. */
export const calendarEvent = (
  overrides: Partial<CalendarEventMessage> = {},
): CalendarEventMessage => ({
  id: "neil:abc123@google.com",
  subject: "Planning",
  sensitivity: "normal",
  importance: "normal",
  occurrenceType: "single",
  type: "meeting",
  reminder: true,
  response: "accepted",
  startTime: "2026-10-05T16:00:00Z",
  endTime: "2026-10-05T17:30:00Z",
  duration: 90,
  allDay: false,
  status: "busy",
  location: "Room 1",
  cancelled: false,
  organizerEmail: "lead@example.com",
  deleted: false,
  uid: "abc123@google.com",
  recurrenceId: null,
  source: "neil",
  recurrenceRule: null,
  account: { provider: "google", subject: "1098" },
  ...overrides,
});
