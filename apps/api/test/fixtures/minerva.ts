/** Hasura rows for Minerva tables, as the API's queries receive them. */
import type { GraphQlMeeting } from "../../src/minerva/meetings/converters/MeetingConverter";
import type { GraphQlNote } from "../../src/minerva/notes/converters/NoteConverter";
import type { GraphQlGoalCategory } from "../../src/minerva/goals/converters/GoalCategoryConverter";
import type { GraphQlGoalCycle } from "../../src/minerva/goals/converters/GoalCycleConverter";
import type { GraphQlTag } from "../../src/minerva/tags/converters/TagConverter";

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

export const TAG_ID = "4c8e1f20-0000-4000-8000-000000000001";

export const graphQlTag = (
  overrides: Partial<GraphQlTag> = {},
): GraphQlTag => ({
  id: TAG_ID,
  name: "olympus",
  color: "#1677ff",
  createdTime: "2026-10-01T12:00:00Z",
  lastUpdatedTime: "2026-10-01T12:30:00Z",
  ...overrides,
});

export const GOAL_CATEGORY_ID = "6a2d9e40-0000-4000-8000-000000000001";

export const graphQlGoalCategory = (
  overrides: Partial<GraphQlGoalCategory> = {},
): GraphQlGoalCategory => ({
  id: GOAL_CATEGORY_ID,
  name: "Health",
  color: "#52c41a",
  icon: "heart",
  vision: "Strong enough to ride all day at 60.",
  position: 0,
  archivedTime: null,
  createdTime: "2026-10-01T12:00:00Z",
  lastUpdatedTime: "2026-10-01T12:30:00Z",
  ...overrides,
});

export const GOAL_CYCLE_ID = "2e7b4c90-0000-4000-8000-000000000001";

/** Cycle 4 on the design canvas: Sep 7 to Nov 29 2026, buffer to Dec 6. */
export const graphQlGoalCycle = (
  overrides: Partial<GraphQlGoalCycle> = {},
): GraphQlGoalCycle => ({
  id: GOAL_CYCLE_ID,
  name: "Cycle 4",
  startDate: "2026-09-07",
  weeks: 12,
  bufferWeeks: 1,
  createdTime: "2026-09-01T12:00:00Z",
  lastUpdatedTime: null,
  ...overrides,
});
