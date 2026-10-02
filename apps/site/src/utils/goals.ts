import type {
  CreateGoalRequest,
  FullGoal,
  Goal,
  GoalCategory,
  GoalCheckin,
  GoalCycle,
  GoalHabitLog,
  GoalHealth,
  GoalHorizon,
  GoalProgressMode,
  GoalRollup,
  GoalStatus,
  GoalType,
  HabitFrequency,
  UpdateGoalRequest,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";

/**
 * Goals on the site (docs/plans/goals/design.md): the words, order and
 * arithmetic the views draw from, kept out of the components so they can
 * be tested without a DOM.
 */

/* Words ------------------------------------------------------------------ */

export const HEALTH: Record<
  GoalHealth,
  { label: string; color: "success" | "warning" | "error"; rank: number }
> = {
  off_track: { label: "Off track", color: "error", rank: 0 },
  at_risk: { label: "At risk", color: "warning", rank: 1 },
  on_track: { label: "On track", color: "success", rank: 2 },
};

export const TYPE_LABEL: Record<GoalType, string> = {
  outcome: "Outcome",
  milestone: "Milestone",
  habit: "Habit",
  achievement: "Achievement",
};

export const STATUS_LABEL: Record<GoalStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  achieved: "Achieved",
  missed: "Missed",
  dropped: "Dropped",
};

export const HORIZON_LABEL: Record<GoalHorizon, string> = {
  year: "Year",
  quarter: "Quarter",
  cycle: "Cycle",
  custom: "Custom",
  ongoing: "Ongoing",
};

export const MODE_LABEL: Record<GoalProgressMode, string> = {
  checkins: "From check-ins",
  milestones: "From milestones",
  habit: "From the habit",
  status: "Done or not",
  subgoals: "Rolled up from sub-goals",
  manual: "Set by hand",
};

export const ROLLUP_LABEL: Record<GoalRollup, string> = {
  average: "Average",
  weighted: "Weighted average",
  sum: "Sum of values",
};

export const FREQUENCY_LABEL: Record<HabitFrequency, string> = {
  daily: "Every day",
  weekdays: "On chosen days",
  weekly: "Times a week",
  monthly: "Times a month",
};

/** The progress modes each type allows; the first is the default (as the API has it). */
export const MODES: Record<GoalType, GoalProgressMode[]> = {
  outcome: ["checkins", "subgoals"],
  milestone: ["milestones", "subgoals", "manual"],
  habit: ["habit"],
  achievement: ["status"],
};

export const CLOSED: GoalStatus[] = ["achieved", "missed", "dropped"];
export const isClosed = (goal: Pick<Goal, "status">) =>
  CLOSED.includes(goal.status);

/** A number as people write it: whole, or to one decimal place. */
export const formatValue = (value: number | undefined): string => {
  if (value === undefined || Number.isNaN(value)) return "–";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString("en-US")
    : rounded.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
};

/** A YYYY-MM-DD day as "Dec 31", with the year when it is not this one. */
export const formatDay = (date: string | undefined, today: string): string => {
  if (!date) return "";
  const day = DateTime.fromISO(date);
  return day.year === DateTime.fromISO(today).year
    ? day.toFormat("LLL d")
    : day.toFormat("LLL d, yyyy");
};

/**
 * What a goal has done, in words, for a row: an outcome's value against
 * its target, a habit's adherence, a rollup's sub-goals.
 */
export const metricText = (goal: Goal): string => {
  if (goal.status === "achieved") return "Achieved";
  switch (goal.progressMode) {
    case "checkins":
      return `${formatValue(goal.currentValue ?? goal.startValue)} of ${formatValue(goal.targetValue)}${goal.unit ? ` ${goal.unit}` : ""}`;
    case "milestones":
      return `${formatValue(goal.progress)}% of milestones`;
    case "habit":
      return `${formatValue(goal.progress)}% adherence`;
    case "subgoals": {
      const n = goal.subGoalIds.length;
      return `Rolled up from ${n} sub-goal${n === 1 ? "" : "s"}`;
    }
    case "manual":
      return `${formatValue(goal.progress)}% done`;
    case "status":
      return "Not achieved yet";
  }
};

/** When a goal is due, in words: its date, or Ongoing. */
export const dueText = (goal: Goal, today: string): string =>
  goal.dueDate ? formatDay(goal.dueDate, today) : "Ongoing";

/** Days from today to a goal's due date; negative once past. */
export const daysLeft = (goal: Goal, today: string): number | undefined =>
  goal.dueDate
    ? Math.round(
        DateTime.fromISO(goal.dueDate).diff(DateTime.fromISO(today), "days")
          .days,
      )
    : undefined;

/* Order ------------------------------------------------------------------ */

/**
 * Focus's order: goals needing a decision first, then off track, at
 * risk and on track; within each, the soonest due first (ongoing last),
 * then board order.
 */
export const rankForFocus = (goals: Goal[]): Goal[] =>
  [...goals].sort((a, b) => {
    if (a.needsDecision !== b.needsDecision) return a.needsDecision ? -1 : 1;
    const ha = a.health ? HEALTH[a.health].rank : 3;
    const hb = b.health ? HEALTH[b.health].rank : 3;
    if (ha !== hb) return ha - hb;
    const da = a.dueDate ?? "9999-12-31";
    const db = b.dueDate ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return a.position - b.position;
  });

/** A goal in a list, with how deep it sits under the goals shown. */
export type GoalRow = { goal: Goal; depth: number; hiddenBelow: number };

/**
 * Goals as an indented list: each sub-goal under its parent, in order.
 * A goal whose parent is not among those given starts at the top. Below
 * `maxDepth` levels the rows are left out, and the row above says how
 * many, unless its ID is in `expanded`.
 */
export const goalTree = (
  goals: Goal[],
  maxDepth = 3,
  expanded: ReadonlySet<string> = new Set(),
): GoalRow[] => {
  const ids = new Set(goals.map((g) => g.id));
  const children = new Map<string, Goal[]>();
  for (const goal of goals) {
    if (goal.parentId && ids.has(goal.parentId)) {
      children.set(goal.parentId, [
        ...(children.get(goal.parentId) ?? []),
        goal,
      ]);
    }
  }
  const count = (goal: Goal): number =>
    (children.get(goal.id) ?? []).reduce((n, c) => n + 1 + count(c), 0);

  const rows: GoalRow[] = [];
  const seen = new Set<string>();
  const walk = (goal: Goal, depth: number) => {
    if (seen.has(goal.id)) return;
    seen.add(goal.id);
    const open = depth + 1 < maxDepth || expanded.has(goal.id);
    rows.push({ goal, depth, hiddenBelow: open ? 0 : count(goal) });
    if (open)
      for (const kid of children.get(goal.id) ?? []) walk(kid, depth + 1);
  };
  for (const goal of goals) {
    if (!goal.parentId || !ids.has(goal.parentId)) walk(goal, 0);
  }
  return rows;
};

/** The board's columns: each category in order with its goals as a tree. */
export const byCategory = (
  goals: Goal[],
  categories: GoalCategory[],
): { category: GoalCategory; goals: Goal[] }[] =>
  categories
    .filter((c) => !c.archived || goals.some((g) => g.categoryId === c.id))
    .map((category) => ({
      category,
      goals: goals.filter((g) => g.categoryId === category.id),
    }));

/** The summary strip's counts. */
export const healthCounts = (goals: Goal[]) => {
  const active = goals.filter((g) => g.status === "active");
  return {
    active: active.length,
    on_track: active.filter((g) => g.health === "on_track").length,
    at_risk: active.filter((g) => g.health === "at_risk").length,
    off_track: active.filter((g) => g.health === "off_track").length,
  };
};

/** The horizon filter's choices and what each asks ListGoals for. */
export type HorizonChoice = "all" | "year" | "quarter" | "cycle" | "ongoing";

/** Whether a goal falls under a horizon choice, by its dates for year and quarter. */
export const inHorizon = (
  goal: Goal,
  choice: HorizonChoice,
  today: string,
  cycle?: GoalCycle,
): boolean => {
  const t = DateTime.fromISO(today);
  const overlaps = (from: DateTime, to: DateTime) =>
    DateTime.fromISO(goal.startDate) <= to &&
    (!goal.dueDate || DateTime.fromISO(goal.dueDate) >= from);
  switch (choice) {
    case "all":
      return true;
    case "year":
      return overlaps(t.startOf("year"), t.endOf("year"));
    case "quarter":
      return overlaps(t.startOf("quarter"), t.endOf("quarter"));
    case "cycle":
      return cycle !== undefined && goal.cycleId === cycle.id;
    case "ongoing":
      return goal.horizon === "ongoing";
  }
};

/** The cycle running today, or in its buffer; else the next to start. */
export const currentCycle = (cycles: GoalCycle[]): GoalCycle | undefined =>
  cycles.find((c) => c.status === "current") ??
  cycles.find((c) => c.status === "buffer") ??
  [...cycles]
    .filter((c) => c.status === "upcoming")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

/* The roadmap ------------------------------------------------------------ */

/** Where a day falls across a span, 0 to 1, clamped. */
export const spanFraction = (date: string, from: string, to: string) => {
  const start = DateTime.fromISO(from);
  const total = DateTime.fromISO(to).plus({ days: 1 }).diff(start, "days").days;
  const at = DateTime.fromISO(date).diff(start, "days").days;
  return Math.min(1, Math.max(0, at / total));
};

/** A band on the roadmap: a label from one fraction of the year to another. */
export type Band = { label: string; from: number; to: number; buffer?: number };

export const quarterBands = (year: number): Band[] =>
  [1, 2, 3, 4].map((q) => {
    const start = DateTime.fromObject({ year, month: (q - 1) * 3 + 1, day: 1 });
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    return {
      label: `Q${q}`,
      from: spanFraction(start.toISODate()!, from, to),
      to: spanFraction(
        start.endOf("quarter").plus({ days: 1 }).toISODate()!,
        from,
        to,
      ),
    };
  });

export const cycleBands = (cycles: GoalCycle[], year: number): Band[] => {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return cycles
    .filter((c) => c.startDate <= to && c.bufferEndDate >= from)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((c) => ({
      label: c.name,
      from: spanFraction(c.startDate, from, to),
      to: spanFraction(
        DateTime.fromISO(c.endDate).plus({ days: 1 }).toISODate()!,
        from,
        to,
      ),
      buffer: spanFraction(
        DateTime.fromISO(c.bufferEndDate).plus({ days: 1 }).toISODate()!,
        from,
        to,
      ),
    }));
};

/** A goal's mark on the roadmap. */
export type RoadmapMark =
  | { kind: "bar"; from: number; to: number; filled: number }
  | { kind: "ongoing"; from: number }
  | { kind: "diamond"; at: number };

export const roadmapMark = (
  goal: Goal,
  year: number,
): RoadmapMark | undefined => {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  if (goal.startDate > to || (goal.dueDate && goal.dueDate < from)) {
    return undefined;
  }
  if (goal.type === "achievement" && goal.dueDate) {
    return { kind: "diamond", at: spanFraction(goal.dueDate, from, to) };
  }
  if (!goal.dueDate) {
    return { kind: "ongoing", from: spanFraction(goal.startDate, from, to) };
  }
  const start = spanFraction(goal.startDate, from, to);
  const end = spanFraction(
    DateTime.fromISO(goal.dueDate).plus({ days: 1 }).toISODate()!,
    from,
    to,
  );
  return { kind: "bar", from: start, to: end, filled: goal.progress / 100 };
};

/* An outcome's numbers and chart ------------------------------------------ */

export type OutcomeNumbers = {
  current: number;
  /** Where pace says the value should be today. */
  expected?: number;
  /** Where the value lands on the due date at the rate so far. */
  projected?: number;
  /** The change per week still needed to reach the target on time. */
  neededPerWeek?: number;
};

export const outcomeNumbers = (goal: Goal, today: string): OutcomeNumbers => {
  const start = goal.startValue ?? 0;
  const target = goal.targetValue ?? 0;
  const current = goal.currentValue ?? start;
  const result: OutcomeNumbers = { current };
  if (goal.expectedProgress !== undefined) {
    result.expected = start + (goal.expectedProgress / 100) * (target - start);
  }
  if (goal.dueDate) {
    const t = DateTime.fromISO(today);
    const begun = t.diff(DateTime.fromISO(goal.startDate), "days").days;
    const left = DateTime.fromISO(goal.dueDate).diff(t, "days").days;
    const span = begun + left;
    if (begun > 0 && span > 0) {
      result.projected = start + ((current - start) / begun) * span;
    }
    if (left > 0) result.neededPerWeek = ((target - current) / left) * 7;
  }
  return result;
};

/** The chart's series, as [epoch ms, value] points. */
export const outcomeSeries = (
  goal: Goal,
  checkins: GoalCheckin[],
  today: string,
) => {
  const ms = (date: string) =>
    DateTime.fromISO(date, { zone: "utc" }).toMillis();
  const start = goal.startValue ?? 0;
  const target = goal.targetValue ?? 0;
  const values = checkins
    .filter((c) => c.value !== undefined)
    .map((c) => [ms(c.checkinDate), c.value as number] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const series = {
    checkins: [[ms(goal.startDate), start] as [number, number], ...values],
    pace: [] as [number, number][],
    band: [] as [number, number, number][],
    projection: [] as [number, number][],
  };
  if (goal.dueDate) {
    const tolerance = (goal.tolerancePct / 100) * Math.abs(target - start);
    series.pace = [
      [ms(goal.startDate), start],
      [ms(goal.dueDate), target],
    ];
    series.band = [
      [ms(goal.startDate), start - tolerance, start + tolerance],
      [ms(goal.dueDate), target - tolerance, target + tolerance],
    ];
    const numbers = outcomeNumbers(goal, today);
    if (numbers.projected !== undefined) {
      series.projection = [
        [ms(today), numbers.current],
        [ms(goal.dueDate), numbers.projected],
      ];
    }
  }
  return series;
};

/* A habit's grid ---------------------------------------------------------- */

export type HabitCell =
  "done" | "partial" | "missed" | "off" | "future" | "before";

/**
 * The habit panel's grid: the last `weeks` ISO weeks, oldest first, each
 * a column of seven days (Monday first) and the week's count of days met.
 * A weekdays habit's other days are "off"; days not due by a daily or
 * weekdays rule are never "missed" for a weekly or monthly habit.
 */
export const habitGrid = (
  logs: GoalHabitLog[],
  rule: { frequency: HabitFrequency; weekdays?: number[] },
  startDate: string,
  today: string,
  weeks = 12,
): { weekOf: string; days: HabitCell[]; met: number }[] => {
  const byDay = new Map(logs.map((l) => [l.logDate, l]));
  const t = DateTime.fromISO(today);
  const first = t.startOf("week").minus({ weeks: weeks - 1 });
  return Array.from({ length: weeks }, (_, w) => {
    const monday = first.plus({ weeks: w });
    let met = 0;
    const days = Array.from({ length: 7 }, (_, d): HabitCell => {
      const day = monday.plus({ days: d });
      const iso = day.toISODate()!;
      if (iso < startDate) return "before";
      if (day > t) return "future";
      const log = byDay.get(iso);
      if (log?.met) {
        met += 1;
        return "done";
      }
      if (log) return "partial";
      if (
        rule.frequency === "weekdays" &&
        !(rule.weekdays ?? []).includes(d + 1)
      ) {
        return "off";
      }
      if (rule.frequency === "daily" || rule.frequency === "weekdays") {
        return iso === today ? "future" : "missed";
      }
      return "off";
    });
    return { weekOf: monday.toISODate()!, days, met };
  });
};

/* The goal form ------------------------------------------------------------ */

/** The goal form's fields; blank text and unset numbers are absent. */
export type GoalFormValues = {
  type: GoalType;
  title: string;
  why?: string;
  categoryId?: string;
  parentId?: string;
  status: "draft" | "active";
  horizon: GoalHorizon;
  cycleId?: string;
  startDate?: string;
  dueDate?: string;
  progressMode: GoalProgressMode;
  rollup?: GoalRollup;
  weight?: number;
  manualProgress?: number;
  unit?: string;
  startValue?: number;
  targetValue?: number;
  tolerancePct?: number;
  frequency?: HabitFrequency;
  timesPerPeriod?: number;
  weekdays?: number[];
  quantityTarget?: number;
  quantityUnit?: string;
  milestones: { title: string; dueDate?: string }[];
  tagIds: string[];
};

export const emptyGoalForm = (
  categoryId?: string,
  parentId?: string,
): GoalFormValues => ({
  type: "outcome",
  title: "",
  categoryId,
  parentId,
  status: "active",
  horizon: "year",
  progressMode: "checkins",
  milestones: [],
  tagIds: [],
});

/** The form's values for an existing goal. */
export const goalToForm = (goal: FullGoal): GoalFormValues => ({
  type: goal.type,
  title: goal.title,
  why: goal.why,
  categoryId: goal.categoryId,
  parentId: goal.parentId,
  status: goal.status === "draft" ? "draft" : "active",
  horizon: goal.horizon,
  cycleId: goal.cycleId,
  startDate: goal.startDate,
  dueDate: goal.dueDate,
  progressMode: goal.progressMode,
  rollup: goal.rollup,
  weight: goal.weight,
  manualProgress: goal.manualProgress,
  unit: goal.unit,
  startValue: goal.startValue,
  targetValue: goal.targetValue,
  tolerancePct: goal.tolerancePct,
  frequency: goal.habitRule?.frequency,
  timesPerPeriod: goal.habitRule?.timesPerPeriod,
  weekdays: goal.habitRule?.weekdays,
  quantityTarget: goal.habitRule?.quantityTarget,
  quantityUnit: goal.habitRule?.quantityUnit,
  milestones: goal.milestones.map((m) => ({
    title: m.title,
    dueDate: m.dueDate,
  })),
  tagIds: goal.tags.map((t) => t.id),
});

const text = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** The goal's own fields from the form, only those its type and mode use. */
const goalFields = (v: GoalFormValues) => {
  const outcome = v.type === "outcome";
  return {
    categoryId: v.categoryId ?? "",
    parentId: v.parentId,
    cycleId: v.horizon === "cycle" ? v.cycleId : undefined,
    title: v.title.trim(),
    why: text(v.why),
    type: v.type,
    status: v.status,
    horizon: v.horizon,
    startDate: v.startDate,
    dueDate: v.horizon === "ongoing" ? undefined : v.dueDate,
    progressMode: v.progressMode,
    rollup: v.progressMode === "subgoals" ? v.rollup : undefined,
    weight: v.weight,
    manualProgress: v.progressMode === "manual" ? v.manualProgress : undefined,
    unit: outcome ? text(v.unit) : undefined,
    startValue: outcome ? v.startValue : undefined,
    targetValue: outcome ? v.targetValue : undefined,
    tolerancePct: v.tolerancePct,
  };
};

const habitRule = (v: GoalFormValues) =>
  v.type !== "habit" || !v.frequency
    ? undefined
    : {
        frequency: v.frequency,
        timesPerPeriod:
          v.frequency === "weekly" || v.frequency === "monthly"
            ? v.timesPerPeriod
            : undefined,
        weekdays: v.frequency === "weekdays" ? v.weekdays : undefined,
        quantityTarget: v.quantityTarget,
        quantityUnit: v.quantityTarget ? text(v.quantityUnit) : undefined,
      };

const dropUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;

/** CreateGoal's body from the form. */
export const formToCreate = (v: GoalFormValues): CreateGoalRequest => {
  const request: CreateGoalRequest = {
    goal: dropUndefined(goalFields(v)) as CreateGoalRequest["goal"],
  };
  const rule = habitRule(v);
  if (rule) request.habitRule = dropUndefined(rule);
  const milestones = v.milestones
    .map((m) => ({ title: m.title.trim(), dueDate: m.dueDate }))
    .filter((m) => m.title);
  if (
    v.type === "milestone" &&
    v.progressMode === "milestones" &&
    milestones.length
  ) {
    request.milestones = milestones.map(dropUndefined);
  }
  if (v.tagIds.length) request.tagIds = v.tagIds;
  return request;
};

/**
 * UpdateGoal's body: only what the form changed, a cleared field as null.
 * Milestones are edited on the goal page, so the form leaves them alone.
 */
export const formToUpdate = (
  before: GoalFormValues,
  after: GoalFormValues,
): UpdateGoalRequest => {
  const was = goalFields(before) as Record<string, unknown>;
  const now = goalFields(after) as Record<string, unknown>;
  const goal: Record<string, unknown> = {};
  for (const key of Object.keys(now)) {
    if (key === "type") continue;
    if (now[key] !== was[key]) goal[key] = now[key] ?? null;
  }
  const request: UpdateGoalRequest = {};
  if (Object.keys(goal).length)
    request.goal = goal as UpdateGoalRequest["goal"];
  const ruleBefore = habitRule(before);
  const ruleAfter = habitRule(after);
  if (ruleAfter && JSON.stringify(ruleAfter) !== JSON.stringify(ruleBefore)) {
    request.habitRule = dropUndefined(ruleAfter);
  }
  if ([...before.tagIds].sort().join() !== [...after.tagIds].sort().join()) {
    request.tagIds = after.tagIds;
  }
  return request;
};

/** What the API said was wrong with a request, as lines to show. */
export const apiProblems = (error: unknown): string[] => {
  const data = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const said = data?.message;
  if (Array.isArray(said)) return said.map(String);
  if (typeof said === "string") return [said];
  return ["Something went wrong; try again."];
};
