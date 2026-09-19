/** Hasura rows for Minerva tables, as the API's queries receive them. */
import type { GraphQlMeeting } from "../../src/minerva/meetings/converters/MeetingConverter";
import type { GraphQlNote } from "../../src/minerva/notes/converters/NoteConverter";

export const graphQlNote = (
  overrides: Partial<GraphQlNote> = {},
): GraphQlNote => ({
  id: "8f7d2c1e-0000-4000-8000-000000000001",
  type: 1 as GraphQlNote["type"],
  author: "ncfritz",
  flagged: false,
  value: "Remember the milk",
  title: "Shopping",
  summary: "Groceries",
  createdTime: "2026-09-01T10:00:00Z",
  lastUpdatedTime: "2026-09-02T11:30:00Z",
  associatedItems: [
    {
      itemId: "movie:603",
      itemType: "movie",
      createdTime: "2026-09-01T10:05:00Z",
    },
  ],
  children_aggregate: { aggregate: { count: 2 } },
  ...overrides,
});

export const graphQlMeeting = (
  overrides: Partial<GraphQlMeeting> = {},
): GraphQlMeeting => ({
  id: "meeting-1",
  uid: "uid-1",
  recurrence_id: "rec-1",
  type: "Meeting",
  subject: "Planning",
  status: "Busy" as GraphQlMeeting["status"],
  source: "amzn" as GraphQlMeeting["source"],
  start_time: "2026-09-18T16:00:00Z",
  end_time: "2026-09-18T17:30:00Z",
  sensitivity: "Normal" as GraphQlMeeting["sensitivity"],
  response: "Accepted",
  reminder: "15",
  organizer: {
    email: "lead@example.com",
    alias: "lead",
    given_name: "Lee",
    surname: "Dar",
    type: "Required",
  },
  occurrence_type: "Single" as GraphQlMeeting["occurrence_type"],
  location: "Room 1",
  importance: "Normal" as GraphQlMeeting["importance"],
  duration: "01:30:00",
  deleted: false,
  cancelled: false,
  all_day: false,
  attendees: [
    {
      attendance: "Required",
      response: "Accepted",
      user: {
        email: "ncfritz@example.com",
        alias: "ncfritz",
        given_name: "Neil",
        surname: "Fritz",
        type: "Required",
      },
    },
  ],
  ...overrides,
});
