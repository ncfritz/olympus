import {
  CreateGoalRequest,
  FullGoal,
  Goal,
  GoalCheckinSource,
  GoalCheckinSuggestion,
  GoalClose,
  GoalExecution,
  GoalHabitDay,
  GoalHealth,
  GoalHorizon,
  GoalNextStep,
  GoalProgressMode,
  GoalStatus,
  GoalType,
  GoalTypeCounts,
  HabitFrequency,
  ListGoalsForTodayResponse,
  UpdateGoalRequest,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { cycleEnds } from "../converters/GoalCycleConverter";
import {
  GraphQlGoal,
  maskToWeekdays,
  toDomainObject,
  toEngineGoal,
  toFullGoal,
  toHabitRule,
  toMilestone,
  weekdaysToMask,
} from "../converters/GoalConverter";
import {
  type GraphQlGoalHabitLog,
  toDomainObject as toHabitLog,
} from "../converters/GoalHabitLogConverter";
import {
  computeExecution,
  computeProgress,
  habitSummary,
  suggestedHealth,
} from "../progress";
import { GOAL, GOAL_HABIT_LOG } from "../queries/goals";
import {
  checkGoalValues,
  checkHabitRule,
  checkIdList,
  checkMilestone,
  CLOSED,
  GOAL_VALUE_KEYS,
  type GoalValues,
  type HabitRuleValues,
} from "../utils/goalValues";
import {
  checkPastDay,
  checkTimezone,
  isoWeekBounds,
  isoWeekOf,
  todayIn,
} from "../utils/localDates";
import {
  checkEnum,
  checkInteger,
  checkNumber,
  checkOptionalText,
  isUuid,
} from "../utils/validation";

/** The statuses ListGoals shows unless told otherwise: the open ones. */
const OPEN = [GoalStatus.Draft, GoalStatus.Active, GoalStatus.Paused];

/** Stands in for a cycle goal's dates until its cycle is read. */
const CYCLE_DATES = "1970-01-05";

export type ListGoalsFilters = {
  status?: unknown;
  categoryId?: unknown;
  cycleId?: unknown;
  horizon?: unknown;
  tagId?: unknown;
  parentId?: unknown;
};

/** A user's goals read whole, with progress worked out for today. */
type GoalsView = {
  rows: Map<string, GraphQlGoal>;
  goals: Map<string, Goal>;
  /** Each goal's live sub-goals, in order. */
  children: Map<string, GraphQlGoal[]>;
};

/**
 * A user's goals in Hasura (ADR 0026). Every method takes the caller's user
 * ID and scopes by it, so another user's goal is simply not found. A user
 * holds tens of goals, so each operation reads them all: rollups need the
 * whole tree, and progress is computed, never stored.
 */
@Injectable()
export class GoalService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** The user's goals that match, in order, with their progress. */
  async list(
    userId: string,
    filters: ListGoalsFilters,
    tz: string,
  ): Promise<Goal[]> {
    const today = todayIn(checkTimezone(tz));
    const matches = checkFilters(filters);
    const view = this.view(await this.rows(userId), today, tz);
    return [...view.goals.values()].filter((g) => !g.deleted && matches(g));
  }

  /** One of the user's goals, deleted or not, in full. */
  async describe(
    userId: string,
    goalId: string,
    tz: string,
  ): Promise<FullGoal> {
    const today = todayIn(checkTimezone(tz));
    return this.full(this.view(await this.rows(userId), today, tz), goalId);
  }

  /**
   * Creates a goal with its habit rule, milestones and tags in one
   * mutation. A cycle goal with no dates takes its cycle's.
   */
  async create(
    userId: string,
    request: CreateGoalRequest | undefined,
    tz: string,
  ): Promise<FullGoal> {
    const today = todayIn(checkTimezone(tz));
    if (!request || typeof request.goal !== "object" || !request.goal) {
      throw new BadRequestException("goal is required");
    }
    const input = { ...(request.goal as Record<string, unknown>) };
    const problems: string[] = [];
    if (
      input.status !== undefined &&
      input.status !== GoalStatus.Draft &&
      input.status !== GoalStatus.Active
    ) {
      problems.push("a new goal is draft or active");
    }
    // A cycle goal's dates may come from its cycle, read below; until then
    // they stand in so the other rules can be checked first.
    const fromCycle = {
      start:
        input.horizon === GoalHorizon.Cycle && input.startDate === undefined,
      due: input.horizon === GoalHorizon.Cycle && input.dueDate === undefined,
    };
    if (fromCycle.start) input.startDate = CYCLE_DATES;
    if (fromCycle.due) input.dueDate = CYCLE_DATES;
    let values = checkGoalValues(input, problems);

    let rule: HabitRuleValues | undefined;
    if (values.type === GoalType.Habit) {
      if (request.habitRule === undefined) {
        problems.push("a habit goal needs a habitRule");
      } else {
        rule = checkHabitRule(request.habitRule, problems);
      }
    } else if (request.habitRule !== undefined) {
      problems.push("only habit goals have a habitRule");
    }
    let milestones: ReturnType<typeof checkMilestone>[] = [];
    if (request.milestones !== undefined) {
      if (!Array.isArray(request.milestones)) {
        problems.push("milestones must be a list");
      } else if (values.type !== GoalType.Milestone) {
        problems.push("only milestone goals have milestones");
      } else {
        milestones = request.milestones.map((m, i) =>
          checkMilestone(m, `milestones[${i}]`, problems),
        );
      }
    }
    const tagIds =
      request.tagIds === undefined
        ? []
        : checkIdList(request.tagIds, "tagIds", problems);
    if (problems.length) throw new BadRequestException(problems);

    const refs = await this.references(userId, {
      categoryId: values.categoryId,
      cycleId: values.cycleId,
      tagIds,
    });
    checkReferences(refs, values.categoryId, values.cycleId, tagIds, problems);
    if (refs.cycle && (fromCycle.start || fromCycle.due)) {
      const ends = cycleEnds(
        refs.cycle.startDate,
        refs.cycle.weeks,
        refs.cycle.bufferWeeks,
      );
      input.startDate = fromCycle.start
        ? refs.cycle.startDate
        : input.startDate;
      input.dueDate = fromCycle.due ? ends.endDate : input.dueDate;
      values = checkGoalValues(input, problems);
    }
    const rows = await this.rows(userId);
    if (values.parentId !== null) {
      const parent = rows.find((r) => r.id === values.parentId);
      if (!parent || parent.deletedTime !== null) {
        problems.push("parentId names no goal of yours");
      }
    }
    if (problems.length) throw new BadRequestException(problems);

    const document = gql`
      mutation CreateGoal($object: minerva_goals_insert_input!) {
        insert_minerva_goals_one(object: $object) {
          id
        }
      }
    `;
    type Result = { insert_minerva_goals_one: { id: string } };
    const object: Record<string, unknown> = {
      userId,
      ...values,
      position: Math.max(-1, ...rows.map((r) => r.position)) + 1,
    };
    if (rule) object.habitRule = { data: ruleColumns(rule) };
    if (milestones.length) {
      object.milestones = {
        data: milestones.map((m, position) => ({ ...m, position })),
      };
    }
    if (tagIds.length) {
      object.goalTags = { data: tagIds.map((tagId) => ({ tagId })) };
    }
    const result = await this.graphQLClient.request<Result>(document, {
      object,
    });
    const id = result.insert_minerva_goals_one.id;
    return this.full(this.view(await this.rows(userId), today, tz), id);
  }

  /**
   * Changes a goal, its habit rule or its tags. The goal as it stands, with
   * the changes laid over it, must be a valid goal. Answers `undefined`
   * when the request names nothing to change.
   */
  async update(
    userId: string,
    goalId: string,
    request: UpdateGoalRequest | undefined,
    tz: string,
  ): Promise<FullGoal | undefined> {
    const today = todayIn(checkTimezone(tz));
    if (!request || typeof request !== "object") {
      throw new BadRequestException("a goal, habitRule or tagIds is required");
    }
    const changes = request.goal as Record<string, unknown> | undefined;
    if (changes !== undefined && (typeof changes !== "object" || !changes)) {
      throw new BadRequestException("goal must be an object");
    }
    if (changes && "type" in changes) {
      throw new BadRequestException(
        "a goal's type cannot change; create a new goal instead",
      );
    }
    const problems: string[] = [];
    const tagIds =
      request.tagIds === undefined
        ? undefined
        : checkIdList(request.tagIds, "tagIds", problems);
    if (problems.length) throw new BadRequestException(problems);

    const rows = await this.rows(userId);
    const row = rows.find((r) => r.id === goalId && r.deletedTime === null);
    if (!row) throw notFound(goalId);
    const named = Object.keys(changes ?? {}).filter((k) =>
      (GOAL_VALUE_KEYS as string[]).includes(k),
    );
    if (
      named.length === 0 &&
      request.habitRule === undefined &&
      tagIds === undefined
    ) {
      return undefined;
    }

    const current = valuesOf(row);
    const merged: Record<string, unknown> = { ...current };
    for (const key of named) merged[key] = changes?.[key];
    // Reopening a closed goal clears its closing date.
    if (
      CLOSED.includes(current.status) &&
      !CLOSED.includes(merged.status as GoalStatus) &&
      !named.includes("closedOn")
    ) {
      merged.closedOn = null;
    }
    if (
      !CLOSED.includes(current.status) &&
      CLOSED.includes(merged.status as GoalStatus)
    ) {
      throw new BadRequestException(
        "a goal is achieved, missed or dropped with CloseGoal",
      );
    }
    const values = checkGoalValues(merged, problems);

    let rule: HabitRuleValues | undefined;
    if (request.habitRule !== undefined) {
      if (values.type !== GoalType.Habit) {
        problems.push("only habit goals have a habitRule");
      } else {
        rule = checkHabitRule(request.habitRule, problems);
      }
    }
    if (values.parentId !== current.parentId && values.parentId !== null) {
      const parent = rows.find((r) => r.id === values.parentId);
      if (!parent || parent.deletedTime !== null) {
        problems.push("parentId names no goal of yours");
      } else if (descendsFrom(rows, values.parentId, goalId)) {
        problems.push("a goal cannot sit under itself or one of its sub-goals");
      }
    }
    if (problems.length) throw new BadRequestException(problems);

    const refs = await this.references(userId, {
      categoryId:
        values.categoryId !== current.categoryId ? values.categoryId : null,
      cycleId: values.cycleId !== current.cycleId ? values.cycleId : null,
      tagIds: tagIds ?? [],
    });
    checkReferences(
      refs,
      values.categoryId !== current.categoryId ? values.categoryId : null,
      values.cycleId !== current.cycleId ? values.cycleId : null,
      tagIds ?? [],
      problems,
    );
    if (problems.length) throw new BadRequestException(problems);

    const set: Partial<GoalValues> = {};
    for (const key of GOAL_VALUE_KEYS) {
      if (values[key] !== current[key]) {
        (set as Record<string, unknown>)[key] = values[key];
      }
    }
    const ruleChanged =
      rule !== undefined &&
      JSON.stringify(ruleColumns(rule)) !==
        JSON.stringify(row.habitRule ? currentRuleColumns(row) : null);
    const had = new Set(row.goalTags.map((t) => t.tag.id));
    const addTags = (tagIds ?? []).filter((id) => !had.has(id));
    const removeTagIds =
      tagIds === undefined ? [] : [...had].filter((id) => !tagIds.includes(id));
    const hasSet = Object.keys(set).length > 0;
    const hasTags = addTags.length > 0 || removeTagIds.length > 0;
    if (!hasSet && !ruleChanged && !hasTags) {
      return this.full(this.view(rows, today, tz), goalId);
    }

    // One transaction: Hasura runs a mutation's root fields in order. The
    // rule is saved by upsert so its created time survives; kept tags are
    // not touched.
    const document = gql`
      mutation UpdateGoal(
        $userId: uuid!
        $goalId: uuid!
        $set: minerva_goals_set_input!
        $hasSet: Boolean!
        $rule: minerva_goal_habit_rules_insert_input!
        $hasRule: Boolean!
        $removeTagIds: [uuid!]!
        $addTags: [minerva_goal_tags_insert_input!]!
        $hasTags: Boolean!
      ) {
        update_minerva_goals(
          where: { id: { _eq: $goalId }, userId: { _eq: $userId } }
          _set: $set
        ) @include(if: $hasSet) {
          affected_rows
        }
        insert_minerva_goal_habit_rules_one(
          object: $rule
          on_conflict: {
            constraint: goal_habit_rules_pkey
            update_columns: [
              frequency
              timesPerPeriod
              weekdays
              quantityTarget
              quantityUnit
            ]
          }
        ) @include(if: $hasRule) {
          goalId
        }
        delete_minerva_goal_tags(
          where: { goalId: { _eq: $goalId }, tagId: { _in: $removeTagIds } }
        ) @include(if: $hasTags) {
          affected_rows
        }
        insert_minerva_goal_tags(objects: $addTags) @include(if: $hasTags) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      userId,
      goalId,
      set,
      hasSet,
      rule: rule ? { goalId, ...ruleColumns(rule) } : { goalId },
      hasRule: ruleChanged,
      removeTagIds,
      addTags: addTags.map((tagId) => ({ goalId, tagId })),
      hasTags,
    });
    return this.full(this.view(await this.rows(userId), today, tz), goalId);
  }

  /**
   * Deletes one of the user's goals, softly: it can be restored. A goal
   * with live sub-goals cannot be deleted.
   */
  async delete(userId: string, goalId: string): Promise<void> {
    const rows = await this.rows(userId);
    const row = rows.find((r) => r.id === goalId && r.deletedTime === null);
    if (!row) throw notFound(goalId);
    if (rows.some((r) => r.parentId === goalId && r.deletedTime === null)) {
      throw new ConflictException(
        "The goal has sub-goals; delete or move them first",
      );
    }
    const document = gql`
      mutation DeleteGoal($userId: uuid!, $goalId: uuid!, $now: timestamptz!) {
        update_minerva_goals(
          where: {
            id: { _eq: $goalId }
            userId: { _eq: $userId }
            deletedTime: { _is_null: true }
          }
          _set: { deletedTime: $now }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { update_minerva_goals: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      goalId,
      now: new Date().toISOString(),
    });
    if (result.update_minerva_goals.affected_rows === 0) throw notFound(goalId);
  }

  /** Brings back a deleted goal; its parent must be live. */
  async restore(userId: string, goalId: string, tz: string): Promise<FullGoal> {
    const today = todayIn(checkTimezone(tz));
    const rows = await this.rows(userId);
    const row = rows.find((r) => r.id === goalId);
    if (!row) throw notFound(goalId);
    if (row.deletedTime === null) {
      throw new ConflictException("The goal is not deleted");
    }
    const parent = rows.find((r) => r.id === row.parentId);
    if (parent && parent.deletedTime !== null) {
      throw new ConflictException(
        "The goal's parent is deleted; restore it first",
      );
    }
    const document = gql`
      mutation RestoreGoal($userId: uuid!, $goalId: uuid!) {
        update_minerva_goals(
          where: { id: { _eq: $goalId }, userId: { _eq: $userId } }
          _set: { deletedTime: null }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, { userId, goalId });
    return this.full(this.view(await this.rows(userId), today, tz), goalId);
  }

  /**
   * Puts some of the user's goals in the order given, sharing out the
   * positions they already hold, so a board column can be reordered alone.
   */
  async reorder(userId: string, goalIds: unknown, tz: string): Promise<Goal[]> {
    const today = todayIn(checkTimezone(tz));
    const problems: string[] = [];
    const ids = checkIdList(goalIds, "goalIds", problems);
    if (!problems.length && ids.length === 0) {
      problems.push("goalIds must name at least one goal");
    }
    if (problems.length) throw new BadRequestException(problems);

    const rows = await this.rows(userId);
    const named = ids.map((id) =>
      rows.find((r) => r.id === id && r.deletedTime === null),
    );
    if (named.some((r) => r === undefined)) {
      throw new BadRequestException("goalIds must name goals of yours");
    }
    const positions = named.map((r) => r!.position).sort((a, b) => a - b);
    const document = gql`
      mutation ReorderGoals($updates: [minerva_goals_updates!]!) {
        update_minerva_goals_many(updates: $updates) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      updates: ids.map((id, i) => ({
        where: { id: { _eq: id }, userId: { _eq: userId } },
        _set: { position: positions[i] },
      })),
    });
    const view = this.view(await this.rows(userId), today, tz);
    return ids.map((id) => view.goals.get(id)!);
  }

  /**
   * The check-in form's defaults for a goal today: where it is, where pace
   * says it should be, and the confidence those numbers suggest.
   */
  async suggestCheckin(
    userId: string,
    goalId: string,
    tz: string,
  ): Promise<GoalCheckinSuggestion> {
    const today = todayIn(checkTimezone(tz));
    const rows = await this.rows(userId);
    const row = rows.find((r) => r.id === goalId && r.deletedTime === null);
    if (!row) throw notFound(goalId);
    const view = this.view(rows, today, tz);
    const goal = view.goals.get(goalId)!;
    const progress = {
      progress: goal.progress,
      currentValue: goal.currentValue,
      expectedProgress: goal.expectedProgress,
    };
    const suggestion: GoalCheckinSuggestion = {
      checkinDate: today,
      progress: goal.progress,
      currentValue: goal.currentValue,
      expectedProgress: goal.expectedProgress,
      confidence: suggestedHealth(toEngineGoal(row, tz), progress, today),
    };
    if (
      goal.expectedProgress !== undefined &&
      goal.startValue !== undefined &&
      goal.targetValue !== undefined
    ) {
      suggestion.expectedValue =
        Math.round(
          (goal.startValue +
            (goal.expectedProgress / 100) *
              (goal.targetValue - goal.startValue)) *
            100,
        ) / 100;
    }
    return suggestion;
  }

  /**
   * The habits due on a day: active habit goals whose rule asks for one
   * that day and whose period is not yet met, or that were logged that day.
   */
  async habitsForDay(
    userId: string,
    date: string,
    tz: string,
  ): Promise<{ date: string; habits: GoalHabitDay[] }> {
    const today = todayIn(checkTimezone(tz));
    const problems: string[] = [];
    const day = checkPastDay(date, "date", today, problems);
    if (problems.length) throw new BadRequestException(problems);

    const rows = await this.rows(userId);
    const view = this.view(rows, today, tz);
    return {
      date: day,
      habits: await this.habitDays(userId, rows, view, day, tz),
    };
  }

  /**
   * What is left to do on the caller's goals today, for the home widget:
   * habits due and not yet met today, milestone goals and their next step,
   * outcome and achievement goals not checked in on today; then the goals
   * already done for today and how many of each type are active.
   */
  async today(userId: string, tz: string): Promise<ListGoalsForTodayResponse> {
    const today = todayIn(checkTimezone(tz));
    const rows = await this.rows(userId);
    const view = this.view(rows, today, tz);
    const days = await this.habitDays(userId, rows, view, today, tz);

    const active: GoalTypeCounts = {
      habit: 0,
      milestone: 0,
      outcome: 0,
      achievement: 0,
    };
    const milestones: GoalNextStep[] = [];
    const outcomes: Goal[] = [];
    const achievements: Goal[] = [];
    const done: Goal[] = days.filter((d) => d.log?.met).map((d) => d.goal);

    for (const row of rows) {
      const engine = toEngineGoal(row, tz);
      if (
        row.deletedTime !== null ||
        engine.status !== GoalStatus.Active ||
        engine.startDate > today
      ) {
        continue;
      }
      active[engine.type as keyof GoalTypeCounts] += 1;
      if (engine.type === GoalType.Habit) continue;

      const goal = view.goals.get(row.id)!;
      // A check-in today, or a milestone ticked today, is today's step.
      if (
        engine.checkins.some((c) => c.date === today) ||
        engine.milestones.some((m) => m.doneOn === today)
      ) {
        done.push(goal);
        continue;
      }
      if (engine.type === GoalType.Milestone) {
        const next =
          engine.progressMode === GoalProgressMode.Milestones
            ? [...row.milestones]
                .sort((a, b) => a.position - b.position)
                .find((m) => m.doneTime === null)
            : undefined;
        milestones.push(
          next ? { goal, milestone: toMilestone(next) } : { goal },
        );
      } else if (engine.type === GoalType.Outcome) {
        outcomes.push(goal);
      } else {
        achievements.push(goal);
      }
    }

    // Habits due every day or on set weekdays come before weekly and
    // monthly ones, which can wait for another day of their period.
    const everyDay = (d: GoalHabitDay) =>
      d.habitRule.frequency === HabitFrequency.Daily ||
      d.habitRule.frequency === HabitFrequency.Weekdays
        ? 0
        : 1;
    const habits = days
      .filter((d) => !d.log?.met && d.periodDone < d.periodCapacity)
      .sort((a, b) => everyDay(a) - everyDay(b) || byAttention(a.goal, b.goal));

    return {
      date: today,
      habits,
      milestones: milestones.sort((a, b) => byAttention(a.goal, b.goal)),
      outcomes: outcomes.sort(byAttention),
      achievements: achievements.sort(byAttention),
      done: done.sort((a, b) => a.position - b.position),
      active,
    };
  }

  /**
   * The habits due on a day: active habit goals whose rule asks for one
   * that day and whose period is not yet met, or that were logged that day.
   */
  private async habitDays(
    userId: string,
    rows: GraphQlGoal[],
    view: GoalsView,
    day: string,
    tz: string,
  ): Promise<GoalHabitDay[]> {
    const document = gql`
      query ListGoalHabitsForDay($userId: uuid!, $logDate: date!) {
        minerva_goal_habit_logs(
          where: {
            logDate: { _eq: $logDate }
            goal: { userId: { _eq: $userId } }
          }
        ) {
          ${GOAL_HABIT_LOG}
        }
      }
    `;
    type Result = { minerva_goal_habit_logs: GraphQlGoalHabitLog[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      logDate: day,
    });
    const logs = new Map(
      result.minerva_goal_habit_logs.map((l) => [l.goalId, l]),
    );

    const habits: GoalHabitDay[] = [];
    for (const row of rows) {
      const engine = toEngineGoal(row, tz);
      if (
        row.deletedTime !== null ||
        engine.type !== GoalType.Habit ||
        engine.status !== GoalStatus.Active ||
        !engine.habitRule ||
        engine.startDate > day ||
        (engine.dueDate !== undefined && engine.dueDate < day)
      ) {
        continue;
      }
      const summary = habitSummary(
        engine.habitRule,
        engine.habitLogs,
        engine.startDate,
        day,
      );
      const log = logs.get(row.id);
      if (
        summary.periodCapacity === 0 ||
        (summary.periodDone >= summary.periodCapacity && !log)
      ) {
        continue;
      }
      habits.push({
        goal: view.goals.get(row.id)!,
        habitRule: toHabitRule(row.habitRule!),
        log: log ? toHabitLog(log, engine.habitRule) : undefined,
        periodDone: summary.periodDone,
        periodCapacity: summary.periodCapacity,
      });
    }
    return habits;
  }

  /**
   * Habit occurrences done over due for an ISO week (`2026-W40`) or a
   * cycle's execution weeks; this week when neither is given.
   */
  async execution(
    userId: string,
    span: { week?: unknown; cycleId?: unknown },
    tz: string,
  ): Promise<GoalExecution> {
    const today = todayIn(checkTimezone(tz));
    const week = span.week === "" ? undefined : span.week;
    const cycleId = span.cycleId === "" ? undefined : span.cycleId;
    if (week !== undefined && cycleId !== undefined) {
      throw new BadRequestException("give a week or a cycleId, not both");
    }
    let range: { from: string; to: string } | undefined;
    if (cycleId !== undefined) {
      if (!isUuid(cycleId)) {
        throw new BadRequestException("cycleId must be an ID");
      }
      const document = gql`
        query GetGoalExecution($userId: uuid!, $cycleId: uuid!) {
          minerva_goal_cycles(
            where: { id: { _eq: $cycleId }, userId: { _eq: $userId } }
          ) {
            startDate
            weeks
            bufferWeeks
          }
        }
      `;
      type Result = {
        minerva_goal_cycles: {
          startDate: string;
          weeks: number;
          bufferWeeks: number;
        }[];
      };
      const result = await this.graphQLClient.request<Result>(document, {
        userId,
        cycleId,
      });
      const cycle = result.minerva_goal_cycles[0];
      if (!cycle) {
        throw new NotFoundException(`Goal cycle with id ${cycleId} not found`);
      }
      range = {
        from: cycle.startDate,
        to: cycleEnds(cycle.startDate, cycle.weeks, cycle.bufferWeeks).endDate,
      };
    } else {
      range = isoWeekBounds(week ?? isoWeekOf(today));
      if (!range) {
        throw new BadRequestException(
          "week must be an ISO week written YYYY-Www, e.g. 2026-W40",
        );
      }
    }
    const rows = await this.rows(userId);
    return computeExecution(
      rows.map((row) => toEngineGoal(row, tz)),
      range.from,
      range.to,
      today,
    );
  }

  /**
   * Closes a goal as achieved, missed or dropped, with the day, a final
   * value or progress, and what was learned. The one way into a closed
   * status; UpdateGoal reopens.
   */
  async close(
    userId: string,
    goalId: string,
    close: GoalClose | undefined,
    tz: string,
  ): Promise<FullGoal> {
    const today = todayIn(checkTimezone(tz));
    if (!close || typeof close !== "object") {
      throw new BadRequestException("goalClose is required");
    }
    const input = close as unknown as Record<string, unknown>;
    const problems: string[] = [];
    const status = checkEnum(input.status, GoalStatus, "status", problems);
    if (!problems.length && !CLOSED.includes(status)) {
      problems.push("status must be achieved, missed or dropped");
    }
    const closedOn =
      input.closedOn === undefined
        ? today
        : checkPastDay(input.closedOn, "closedOn", today, problems);
    const finalValue =
      input.finalValue === undefined || input.finalValue === null
        ? undefined
        : checkNumber(input.finalValue, "finalValue", problems);
    const finalProgress =
      input.finalProgress === undefined || input.finalProgress === null
        ? undefined
        : checkInteger(input.finalProgress, "finalProgress", 0, 100, problems);
    const note = checkOptionalText(input.note, "note", 2000, problems);
    if (problems.length) throw new BadRequestException(problems);

    const rows = await this.rows(userId);
    const row = rows.find((r) => r.id === goalId && r.deletedTime === null);
    if (!row) throw notFound(goalId);
    if (CLOSED.includes(row.status as GoalStatus)) {
      throw new ConflictException(
        `The goal is already ${row.status}; reopen it first`,
      );
    }
    if (finalValue !== undefined && row.type !== GoalType.Outcome) {
      problems.push("only outcome goals have a finalValue");
    }
    if (
      finalProgress !== undefined &&
      row.progressMode !== GoalProgressMode.Manual
    ) {
      problems.push(
        "only goals with progress set by hand have a finalProgress",
      );
    }
    if (closedOn < row.startDate) {
      problems.push(
        `closedOn must not be before the goal starts, ${row.startDate}`,
      );
    }
    if (problems.length) throw new BadRequestException(problems);

    const set: Record<string, unknown> = { status, closedOn };
    if (note !== null) set.closeNote = note;
    if (finalProgress !== undefined) set.manualProgress = finalProgress;
    // The final value is a check-in on the closing day, so the goal's
    // current value and history end where it closed.
    const document = gql`
      mutation CloseGoal(
        $userId: uuid!
        $goalId: uuid!
        $set: minerva_goals_set_input!
        $checkin: minerva_goal_checkins_insert_input!
        $hasCheckin: Boolean!
      ) {
        update_minerva_goals(
          where: {
            id: { _eq: $goalId }
            userId: { _eq: $userId }
            deletedTime: { _is_null: true }
          }
          _set: $set
        ) {
          affected_rows
        }
        insert_minerva_goal_checkins_one(object: $checkin)
          @include(if: $hasCheckin) {
          id
        }
      }
    `;
    await this.graphQLClient.request(document, {
      userId,
      goalId,
      set,
      checkin:
        finalValue === undefined
          ? { goalId }
          : {
              goalId,
              checkinDate: closedOn,
              value: finalValue,
              source: GoalCheckinSource.Goal,
            },
      hasCheckin: finalValue !== undefined,
    });
    return this.full(this.view(await this.rows(userId), today, tz), goalId);
  }

  /** Every one of the user's goals, deleted ones included. */
  private async rows(userId: string): Promise<GraphQlGoal[]> {
    const document = gql`
      query ListGoals($userId: uuid!) {
        minerva_goals(
          where: { userId: { _eq: $userId } }
          order_by: [{ position: asc }, { createdTime: asc }]
        ) {
          ${GOAL}
        }
      }
    `;
    type Result = { minerva_goals: GraphQlGoal[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
    });
    return result.minerva_goals;
  }

  /** The categories, cycle and tags a goal names, if they are the user's. */
  private async references(
    userId: string,
    ids: {
      categoryId: string | null;
      cycleId: string | null;
      tagIds: string[];
    },
  ): Promise<References> {
    const none = { id: { _in: [] } };
    const mine = (id: string | null) =>
      id === null ? none : { id: { _eq: id }, userId: { _eq: userId } };
    const document = gql`
      query GetGoalReferences(
        $categoryWhere: minerva_goal_categories_bool_exp!
        $cycleWhere: minerva_goal_cycles_bool_exp!
        $tagWhere: minerva_tags_bool_exp!
      ) {
        minerva_goal_categories(where: $categoryWhere) {
          id
          archivedTime
        }
        minerva_goal_cycles(where: $cycleWhere) {
          id
          startDate
          weeks
          bufferWeeks
        }
        minerva_tags(where: $tagWhere) {
          id
        }
      }
    `;
    type Result = {
      minerva_goal_categories: { id: string; archivedTime: string | null }[];
      minerva_goal_cycles: {
        id: string;
        startDate: string;
        weeks: number;
        bufferWeeks: number;
      }[];
      minerva_tags: { id: string }[];
    };
    const result = await this.graphQLClient.request<Result>(document, {
      categoryWhere: mine(ids.categoryId),
      cycleWhere: mine(ids.cycleId),
      tagWhere: ids.tagIds.length
        ? { id: { _in: ids.tagIds }, userId: { _eq: userId } }
        : none,
    });
    return {
      category: result.minerva_goal_categories[0],
      cycle: result.minerva_goal_cycles[0],
      tagCount: result.minerva_tags.length,
    };
  }

  /** The user's goals with progress worked out for `today`. */
  private view(rows: GraphQlGoal[], today: string, tz: string): GoalsView {
    const progress = computeProgress(
      rows.map((row) => toEngineGoal(row, tz)),
      today,
    );
    const children = new Map<string, GraphQlGoal[]>();
    for (const row of rows) {
      if (row.deletedTime !== null || row.parentId === null) continue;
      children.set(row.parentId, [...(children.get(row.parentId) ?? []), row]);
    }
    const goals = new Map(
      rows.map((row) => [
        row.id,
        toDomainObject(
          row,
          progress.get(row.id) ?? { progress: 0 },
          (children.get(row.id) ?? []).map((c) => c.id),
        ),
      ]),
    );
    return { rows: new Map(rows.map((r) => [r.id, r])), goals, children };
  }

  private full(view: GoalsView, goalId: string): FullGoal {
    const row = view.rows.get(goalId);
    const goal = view.goals.get(goalId);
    if (!row || !goal) throw notFound(goalId);
    const subGoals = (view.children.get(goalId) ?? []).map((c) =>
      view.goals.get(c.id)!,
    );
    return toFullGoal(row, goal, subGoals);
  }
}

type References = {
  category?: { id: string; archivedTime: string | null };
  cycle?: { id: string; startDate: string; weeks: number; bufferWeeks: number };
  tagCount: number;
};

const notFound = (goalId: string) =>
  new NotFoundException(`Goal with id ${goalId} not found`);

/** A named category, cycle and tags must be the caller's; a named category not archived. */
const checkReferences = (
  refs: References,
  categoryId: string | null,
  cycleId: string | null,
  tagIds: string[],
  problems: string[],
): void => {
  if (categoryId !== null) {
    if (!refs.category) problems.push("categoryId names no category of yours");
    else if (refs.category.archivedTime !== null) {
      problems.push("categoryId names an archived category");
    }
  }
  if (cycleId !== null && !refs.cycle) {
    problems.push("cycleId names no cycle of yours");
  }
  if (refs.tagCount !== tagIds.length) {
    problems.push("tagIds must name tags of yours");
  }
};

/** Whether `goalId` is `ancestorId` or sits somewhere beneath it. */
const descendsFrom = (
  rows: GraphQlGoal[],
  goalId: string,
  ancestorId: string,
): boolean => {
  const parents = new Map(rows.map((r) => [r.id, r.parentId]));
  const seen = new Set<string>();
  for (let id: string | null | undefined = goalId; id; id = parents.get(id)) {
    if (id === ancestorId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return false;
};

/** A row's stored values, numbers as numbers. */
const valuesOf = (row: GraphQlGoal): GoalValues => ({
  categoryId: row.categoryId,
  parentId: row.parentId,
  cycleId: row.cycleId,
  title: row.title,
  why: row.why,
  type: row.type as GoalValues["type"],
  status: row.status as GoalValues["status"],
  horizon: row.horizon as GoalValues["horizon"],
  startDate: row.startDate,
  dueDate: row.dueDate,
  progressMode: row.progressMode as GoalValues["progressMode"],
  rollup: row.rollup as GoalValues["rollup"],
  weight: Number(row.weight),
  manualProgress: row.manualProgress,
  unit: row.unit,
  startValue: row.startValue === null ? null : Number(row.startValue),
  targetValue: row.targetValue === null ? null : Number(row.targetValue),
  tolerancePct: row.tolerancePct,
  closedOn: row.closedOn,
  closeNote: row.closeNote,
});

/** A habit rule's columns, the weekdays as the stored mask. */
const ruleColumns = (rule: HabitRuleValues) => ({
  frequency: rule.frequency,
  timesPerPeriod: rule.timesPerPeriod,
  weekdays: rule.weekdays === null ? null : weekdaysToMask(rule.weekdays),
  quantityTarget: rule.quantityTarget,
  quantityUnit: rule.quantityUnit,
});

const currentRuleColumns = (row: GraphQlGoal) => {
  const rule = row.habitRule!;
  return ruleColumns({
    frequency: rule.frequency as HabitRuleValues["frequency"],
    timesPerPeriod: rule.timesPerPeriod,
    weekdays: rule.weekdays === null ? null : maskToWeekdays(rule.weekdays),
    quantityTarget:
      rule.quantityTarget === null ? null : Number(rule.quantityTarget),
    quantityUnit: rule.quantityUnit,
  });
};

/** ListGoals' filters, checked, as a test on each goal. */
const checkFilters = (filters: ListGoalsFilters): ((goal: Goal) => boolean) => {
  const problems: string[] = [];
  const text = (value: unknown, name: string): string | undefined => {
    if (value === undefined || value === "") return undefined;
    if (typeof value !== "string") {
      problems.push(`${name} may be given once`);
      return undefined;
    }
    return value;
  };
  const id = (value: unknown, name: string, allowNone = false) => {
    const v = text(value, name);
    if (v === undefined || (allowNone && v === "none")) return v;
    if (!isUuid(v))
      problems.push(`${name} must be an ID${allowNone ? " or none" : ""}`);
    return v;
  };

  const statusText = text(filters.status, "status");
  const statuses =
    statusText === undefined
      ? OPEN
      : statusText
          .split(",")
          .map((s) => checkEnum(s.trim(), GoalStatus, "status", problems));
  const categoryId = id(filters.categoryId, "categoryId");
  const cycleId = id(filters.cycleId, "cycleId");
  const tagId = id(filters.tagId, "tagId");
  const parentId = id(filters.parentId, "parentId", true);
  const horizonText = text(filters.horizon, "horizon");
  const horizon =
    horizonText === undefined
      ? undefined
      : checkEnum(horizonText, GoalHorizon, "horizon", problems);
  if (problems.length) throw new BadRequestException(problems);

  return (goal) =>
    statuses.includes(goal.status) &&
    (categoryId === undefined || goal.categoryId === categoryId) &&
    (cycleId === undefined || goal.cycleId === cycleId) &&
    (horizon === undefined || goal.horizon === horizon) &&
    (tagId === undefined || goal.tagIds.includes(tagId)) &&
    (parentId === undefined ||
      (parentId === "none"
        ? goal.parentId === undefined
        : goal.parentId === parentId));
};

const HEALTH_RANK: Record<GoalHealth, number> = {
  [GoalHealth.OffTrack]: 0,
  [GoalHealth.AtRisk]: 1,
  [GoalHealth.OnTrack]: 2,
};

/**
 * Focus's order: a goal asking for a decision first, then the least
 * healthy, then the soonest due, then the caller's own order.
 */
const byAttention = (a: Goal, b: Goal): number => {
  if (a.needsDecision !== b.needsDecision) return a.needsDecision ? -1 : 1;
  const ha = a.health === undefined ? 3 : HEALTH_RANK[a.health];
  const hb = b.health === undefined ? 3 : HEALTH_RANK[b.health];
  if (ha !== hb) return ha - hb;
  const da = a.dueDate ?? "9999-12-31";
  const db = b.dueDate ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  return a.position - b.position;
};
