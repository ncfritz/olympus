/** Hasura rows for Minerva tables, as the API's queries receive them. */
import type { GraphQlMeeting } from "../../src/minerva/meetings/converters/MeetingConverter";
import type { GraphQlNote } from "../../src/minerva/notes/converters/NoteConverter";
import type { GraphQlGoalCategory } from "../../src/minerva/goals/converters/GoalCategoryConverter";
import type {
  GraphQlGoal,
  GraphQlGoalMilestone,
} from "../../src/minerva/goals/converters/GoalConverter";
import type { GraphQlGoalCycle } from "../../src/minerva/goals/converters/GoalCycleConverter";
import type { GraphQlGoalCheckin } from "../../src/minerva/goals/converters/GoalCheckinConverter";
import type { GraphQlGoalHabitLog } from "../../src/minerva/goals/converters/GoalHabitLogConverter";
import type { GraphQlTag } from "../../src/minerva/tags/converters/TagConverter";
import type {
  GraphQlReview,
  GraphQlReviewAnswer,
} from "../../src/minerva/reviews/converters/ReviewConverter";
import type { GraphQlReviewPrompt } from "../../src/minerva/reviews/converters/ReviewPromptConverter";

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
  goalTags_aggregate: { aggregate: { count: 3 } },
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

export const GOAL_ID = "9b1c0000-0000-4000-8000-000000000001";
export const GOAL_MILESTONE_ID = "8c3d0000-0000-4000-8000-000000000001";

export const graphQlGoalMilestone = (
  overrides: Partial<GraphQlGoalMilestone> = {},
): GraphQlGoalMilestone => ({
  id: GOAL_MILESTONE_ID,
  goalId: GOAL_ID,
  title: "Data model and migrations",
  dueDate: "2026-09-18",
  weight: 1,
  position: 0,
  doneTime: "2026-09-18T20:00:00Z",
  createdTime: "2026-09-07T12:00:00Z",
  lastUpdatedTime: null,
  ...overrides,
});

/**
 * "Ship Minerva Goals v1" on the design canvas: a milestone goal in Cycle
 * 4, two of its six milestones done.
 */
export const graphQlGoal = (
  overrides: Partial<GraphQlGoal> = {},
): GraphQlGoal => ({
  id: GOAL_ID,
  parentId: null,
  categoryId: GOAL_CATEGORY_ID,
  cycleId: GOAL_CYCLE_ID,
  title: "Ship Minerva Goals v1",
  why: "Goals belong next to the reviews.",
  type: "milestone",
  status: "active",
  horizon: "cycle",
  startDate: "2026-09-07",
  dueDate: "2026-11-29",
  progressMode: "milestones",
  rollup: null,
  weight: 1,
  manualProgress: null,
  position: 0,
  unit: null,
  startValue: null,
  targetValue: null,
  tolerancePct: 10,
  closedOn: null,
  closeNote: null,
  deletedTime: null,
  createdTime: "2026-09-07T12:00:00Z",
  lastUpdatedTime: null,
  habitRule: null,
  milestones: [
    "Data model and migrations",
    "Hasura actions and triggers",
    "Goals home and goal page",
    "Check-in in Weekly Reflect",
    "Habits strip on Minerva Home",
    "iOS Goals view",
  ].map((title, position) =>
    graphQlGoalMilestone({
      id: `8c3d0000-0000-4000-8000-00000000000${position + 1}`,
      title,
      position,
      doneTime: position < 2 ? "2026-09-20T20:00:00Z" : null,
    }),
  ),
  goalTags: [{ tag: graphQlTag() }],
  checkins: [],
  habitLogs: [],
  ...overrides,
});

export const GOAL_CHECKIN_ID = "7d4e0000-0000-4000-8000-000000000001";

/** A check-in on the canvas goal: on track, from the goal page. */
export const graphQlGoalCheckin = (
  overrides: Partial<GraphQlGoalCheckin> = {},
): GraphQlGoalCheckin => ({
  id: GOAL_CHECKIN_ID,
  goalId: GOAL_ID,
  checkinDate: "2026-09-25",
  value: null,
  confidence: "on_track",
  note: "Schema merged",
  source: "goal",
  createdTime: "2026-09-25T20:00:00Z",
  lastUpdatedTime: null,
  ...overrides,
});

export const GOAL_HABIT_LOG_ID = "3a5f0000-0000-4000-8000-000000000001";

/** A run logged on Monday Sep 28. */
export const graphQlGoalHabitLog = (
  overrides: Partial<GraphQlGoalHabitLog> = {},
): GraphQlGoalHabitLog => ({
  id: GOAL_HABIT_LOG_ID,
  goalId: GOAL_ID,
  logDate: "2026-09-28",
  done: true,
  quantity: null,
  note: null,
  createdTime: "2026-09-28T15:00:00Z",
  lastUpdatedTime: null,
  ...overrides,
});

export const REVIEW_ID = "7b3e1d00-0000-4000-8000-000000000001";
export const REVIEW_PROMPT_ID = "8c4f2e00-0000-4000-8000-000000000001";
export const REVIEW_ANSWER_ID = "9d5a3f00-0000-4000-8000-000000000001";

/** "What went well?" on the design canvas's Thursday, 2026-10-01. */
export const graphQlReviewAnswer = (
  overrides: Partial<GraphQlReviewAnswer> = {},
): GraphQlReviewAnswer => ({
  id: REVIEW_ANSWER_ID,
  promptId: REVIEW_PROMPT_ID,
  body: "Design review landed: we agreed on the rollup tiers.",
  createdTime: "2026-10-01T21:30:00Z",
  lastUpdatedTime: "2026-10-01T21:30:00Z",
  ...overrides,
});

/** The daily review of 2026-10-01 as the canvas draws it: a draft at Reflect. */
export const graphQlReview = (
  overrides: Partial<GraphQlReview> = {},
): GraphQlReview => ({
  id: REVIEW_ID,
  kind: "daily",
  periodStart: "2026-10-01",
  step: 2,
  overall: 4,
  mood: 4,
  energy: 3,
  focus: 2,
  progress: null,
  balance: null,
  completedTime: null,
  createdTime: "2026-10-01T21:00:00Z",
  lastUpdatedTime: "2026-10-01T21:30:00Z",
  answers: [graphQlReviewAnswer()],
  ...overrides,
});

export const graphQlReviewPrompt = (
  overrides: Partial<GraphQlReviewPrompt> = {},
): GraphQlReviewPrompt => ({
  id: REVIEW_PROMPT_ID,
  kind: "daily",
  section: "reflect",
  label: "What went well?",
  placeholder: null,
  position: 0,
  archivedTime: null,
  createdTime: "2026-10-01T12:00:00Z",
  lastUpdatedTime: "2026-10-01T12:00:00Z",
  ...overrides,
});
