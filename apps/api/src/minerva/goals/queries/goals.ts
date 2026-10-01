import { TAG } from "../../tags/queries/tags";

export const GOAL_HABIT_RULE = `frequency
  timesPerPeriod
  weekdays
  quantityTarget
  quantityUnit
  createdTime
  lastUpdatedTime`;

export const GOAL_MILESTONE = `id
  goalId
  title
  dueDate
  weight
  position
  doneTime
  createdTime
  lastUpdatedTime`;

/**
 * A goal with everything progress is computed from and a FullGoal shows:
 * a user holds tens of goals, so every read takes them whole.
 */
export const GOAL = `id
  parentId
  categoryId
  cycleId
  title
  why
  type
  status
  horizon
  startDate
  dueDate
  progressMode
  rollup
  weight
  manualProgress
  position
  unit
  startValue
  targetValue
  tolerancePct
  closedOn
  closeNote
  deletedTime
  createdTime
  lastUpdatedTime
  habitRule {
    ${GOAL_HABIT_RULE}
  }
  milestones(order_by: { position: asc }) {
    ${GOAL_MILESTONE}
  }
  goalTags {
    tag {
      ${TAG}
    }
  }`;
