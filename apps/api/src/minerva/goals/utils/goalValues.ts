import {
  GoalHorizon,
  GoalProgressMode,
  GoalRollup,
  GoalStatus,
  GoalType,
  HabitFrequency,
} from "@ncfritz/olympus-model";
import { isIsoDate } from "../../utils/localDates";
import {
  checkEnum,
  checkInteger,
  checkNumber,
  checkOptionalText,
  isStringList,
  isUuid,
} from "../../utils/validation";

/**
 * A goal's stored values, by Hasura's column names. Create validates a new
 * goal's; update validates the goal as it stands with the changes laid
 * over it, so the rules live in one place and match the table's CHECKs.
 */
export type GoalValues = {
  categoryId: string;
  parentId: string | null;
  cycleId: string | null;
  title: string;
  why: string | null;
  type: GoalType;
  status: GoalStatus;
  horizon: GoalHorizon;
  startDate: string;
  dueDate: string | null;
  progressMode: GoalProgressMode;
  rollup: GoalRollup | null;
  weight: number;
  manualProgress: number | null;
  unit: string | null;
  startValue: number | null;
  targetValue: number | null;
  tolerancePct: number;
  closedOn: string | null;
  closeNote: string | null;
};

export const GOAL_VALUE_KEYS: ReadonlyArray<keyof GoalValues> = [
  "categoryId",
  "parentId",
  "cycleId",
  "title",
  "why",
  "type",
  "status",
  "horizon",
  "startDate",
  "dueDate",
  "progressMode",
  "rollup",
  "weight",
  "manualProgress",
  "unit",
  "startValue",
  "targetValue",
  "tolerancePct",
  "closedOn",
  "closeNote",
];

/** The progress modes each type allows; the first is the default. */
export const MODES: Record<GoalType, GoalProgressMode[]> = {
  [GoalType.Outcome]: [GoalProgressMode.Checkins, GoalProgressMode.Subgoals],
  [GoalType.Milestone]: [
    GoalProgressMode.Milestones,
    GoalProgressMode.Subgoals,
    GoalProgressMode.Manual,
  ],
  [GoalType.Habit]: [GoalProgressMode.Habit],
  [GoalType.Achievement]: [GoalProgressMode.Status],
};

export const CLOSED: ReadonlyArray<GoalStatus> = [
  GoalStatus.Achieved,
  GoalStatus.Missed,
  GoalStatus.Dropped,
];

const MAX_TITLE = 120;
const MAX_WHY = 500;
const MAX_NOTE = 2000;
const MAX_UNIT = 20;

/** `value`, or null when it is absent or null. */
const orNull = <T>(value: T | null | undefined): T | null =>
  value === undefined ? null : value;

/**
 * Checks a goal's values, each and together, collecting every problem.
 * `input` is the goal as it would be stored: absent and null both mean
 * none. Defaults (progress mode, weight, tolerance) are filled first.
 */
export const checkGoalValues = (
  input: Record<string, unknown>,
  problems: string[],
): GoalValues => {
  const type = checkEnum(input.type, GoalType, "type", problems);
  const progressMode =
    input.progressMode === undefined || input.progressMode === null
      ? (MODES[type]?.[0] ?? GoalProgressMode.Status)
      : checkEnum(
          input.progressMode,
          GoalProgressMode,
          "progressMode",
          problems,
        );

  const values: GoalValues = {
    categoryId: checkId(input.categoryId, "categoryId", problems, true) ?? "",
    parentId: checkId(input.parentId, "parentId", problems, false),
    cycleId: checkId(input.cycleId, "cycleId", problems, false),
    title: checkTitle(input.title, problems),
    why: checkOptionalText(input.why, "why", MAX_WHY, problems),
    type,
    status:
      input.status === undefined || input.status === null
        ? GoalStatus.Active
        : checkEnum(input.status, GoalStatus, "status", problems),
    horizon: checkEnum(input.horizon, GoalHorizon, "horizon", problems),
    startDate: checkDate(input.startDate, "startDate", problems, true) ?? "",
    dueDate: checkDate(input.dueDate, "dueDate", problems, false),
    progressMode,
    rollup:
      input.rollup === undefined || input.rollup === null
        ? null
        : checkEnum(input.rollup, GoalRollup, "rollup", problems),
    weight:
      input.weight === undefined || input.weight === null
        ? 1
        : checkNumber(input.weight, "weight", problems, {
            min: 0,
            max: 1000,
            exclusiveMin: true,
          }),
    manualProgress:
      input.manualProgress === undefined || input.manualProgress === null
        ? null
        : checkInteger(
            input.manualProgress,
            "manualProgress",
            0,
            100,
            problems,
          ),
    unit: checkOptionalText(input.unit, "unit", MAX_UNIT, problems),
    startValue: orNull(
      input.startValue === undefined || input.startValue === null
        ? undefined
        : checkNumber(input.startValue, "startValue", problems),
    ),
    targetValue: orNull(
      input.targetValue === undefined || input.targetValue === null
        ? undefined
        : checkNumber(input.targetValue, "targetValue", problems),
    ),
    tolerancePct:
      input.tolerancePct === undefined || input.tolerancePct === null
        ? 10
        : checkInteger(input.tolerancePct, "tolerancePct", 1, 50, problems),
    closedOn: checkDate(input.closedOn, "closedOn", problems, false),
    closeNote: checkOptionalText(
      input.closeNote,
      "closeNote",
      MAX_NOTE,
      problems,
    ),
  };
  if (problems.length) return values;

  // Together, as the table's CHECKs have it.
  if (!MODES[type].includes(progressMode)) {
    problems.push(
      `progressMode for a ${type} goal must be one of ${MODES[type].join(", ")}`,
    );
  }
  if (
    (progressMode === GoalProgressMode.Subgoals) !==
    (values.rollup !== null)
  ) {
    problems.push(
      "rollup is needed exactly when progress comes from sub-goals",
    );
  }
  if (values.rollup === GoalRollup.Sum && type !== GoalType.Outcome) {
    problems.push("a sum rollup is for outcome goals");
  }
  if (
    (progressMode === GoalProgressMode.Manual) !==
    (values.manualProgress !== null)
  ) {
    problems.push(
      "manualProgress is needed exactly when progress is set by hand",
    );
  }
  if (type === GoalType.Outcome) {
    if (values.startValue === null || values.targetValue === null) {
      problems.push("an outcome goal needs a startValue and a targetValue");
    } else if (values.startValue === values.targetValue) {
      problems.push(
        "an outcome goal's targetValue must differ from its startValue",
      );
    }
  } else if (
    values.startValue !== null ||
    values.targetValue !== null ||
    values.unit !== null
  ) {
    problems.push("only outcome goals have a unit, startValue and targetValue");
  }
  if (values.dueDate !== null && values.dueDate < values.startDate) {
    problems.push("dueDate must not be before startDate");
  }
  if ((values.horizon === GoalHorizon.Ongoing) !== (values.dueDate === null)) {
    problems.push(
      "an ongoing goal has no dueDate, and every other goal has one",
    );
  }
  if ((values.horizon === GoalHorizon.Cycle) !== (values.cycleId !== null)) {
    problems.push(
      "a cycle goal needs a cycleId, and only a cycle goal has one",
    );
  }
  if (CLOSED.includes(values.status) !== (values.closedOn !== null)) {
    problems.push(
      "closedOn is needed exactly when the goal is achieved, missed or dropped",
    );
  }
  return values;
};

/** A habit rule as stored: the weekdays as a mask. */
export type HabitRuleValues = {
  frequency: HabitFrequency;
  timesPerPeriod: number;
  weekdays: number[] | null;
  quantityTarget: number | null;
  quantityUnit: string | null;
};

export const checkHabitRule = (
  input: unknown,
  problems: string[],
): HabitRuleValues => {
  const rule = (input ?? {}) as Record<string, unknown>;
  if (!input || typeof input !== "object") {
    problems.push("habitRule must be an object");
  }
  const frequency = checkEnum(
    rule.frequency,
    HabitFrequency,
    "habitRule.frequency",
    problems,
  );
  const max =
    frequency === HabitFrequency.Weekly
      ? 7
      : frequency === HabitFrequency.Monthly
        ? 31
        : 1;
  const timesPerPeriod =
    rule.timesPerPeriod === undefined
      ? 1
      : checkInteger(
          rule.timesPerPeriod,
          "habitRule.timesPerPeriod",
          1,
          max,
          problems,
        );
  let weekdays: number[] | null = null;
  if (frequency === HabitFrequency.Weekdays) {
    const days = rule.weekdays;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      !days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) ||
      new Set(days).size !== days.length
    ) {
      problems.push("habitRule.weekdays must name ISO days 1 to 7, each once");
    } else {
      weekdays = [...(days as number[])].sort();
    }
  } else if (rule.weekdays !== undefined && rule.weekdays !== null) {
    problems.push("habitRule.weekdays is only for a weekdays habit");
  }
  const quantityTarget =
    rule.quantityTarget === undefined || rule.quantityTarget === null
      ? null
      : checkNumber(rule.quantityTarget, "habitRule.quantityTarget", problems, {
          min: 0,
          exclusiveMin: true,
        });
  const quantityUnit = checkOptionalText(
    rule.quantityUnit,
    "habitRule.quantityUnit",
    MAX_UNIT,
    problems,
  );
  if (quantityUnit !== null && quantityTarget === null) {
    problems.push("habitRule.quantityUnit needs a quantityTarget");
  }
  return { frequency, timesPerPeriod, weekdays, quantityTarget, quantityUnit };
};

/** A milestone as supplied on create. */
export type MilestoneValues = {
  title: string;
  dueDate: string | null;
  weight: number;
};

export const checkMilestone = (
  input: unknown,
  name: string,
  problems: string[],
): MilestoneValues => {
  const m = (input ?? {}) as Record<string, unknown>;
  if (!input || typeof input !== "object") {
    problems.push(`${name} must be an object`);
  }
  return {
    title: checkTitle(m.title, problems, `${name}.title`),
    dueDate: checkDate(m.dueDate, `${name}.dueDate`, problems, false),
    weight:
      m.weight === undefined || m.weight === null
        ? 1
        : checkNumber(m.weight, `${name}.weight`, problems, {
            min: 0,
            max: 1000,
            exclusiveMin: true,
          }),
  };
};

/** A list of distinct IDs, as tag and reorder lists are. */
export const checkIdList = (
  value: unknown,
  name: string,
  problems: string[],
): string[] => {
  if (!isStringList(value) || !value.every(isUuid)) {
    problems.push(`${name} must be a list of IDs`);
    return [];
  }
  if (new Set(value).size !== value.length) {
    problems.push(`${name} must not name an ID twice`);
  }
  return value;
};

export const checkTitle = (
  value: unknown,
  problems: string[],
  name = "title",
): string => {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    problems.push(`${name} must be 1 to ${MAX_TITLE} characters`);
  }
  return title;
};

export const checkDate = (
  value: unknown,
  name: string,
  problems: string[],
  required: boolean,
): string | null => {
  if (value === undefined || value === null) {
    if (required) problems.push(`${name} is required, written YYYY-MM-DD`);
    return null;
  }
  if (!isIsoDate(value)) {
    problems.push(`${name} must be a date written YYYY-MM-DD`);
    return null;
  }
  return value;
};

const checkId = (
  value: unknown,
  name: string,
  problems: string[],
  required: boolean,
): string | null => {
  if (value === undefined || value === null) {
    if (required) problems.push(`${name} is required`);
    return null;
  }
  if (!isUuid(value)) {
    problems.push(`${name} must be an ID`);
    return null;
  }
  return value;
};
