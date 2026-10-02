import {
  BaseGoalHabitLog,
  GoalHabitLog,
  GoalHabitSummary,
  GoalStatus,
  GoalType,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  type GraphQlGoalHabitRule,
  maskToWeekdays,
} from "../converters/GoalConverter";
import {
  type GraphQlGoalHabitLog,
  toDomainObject,
} from "../converters/GoalHabitLogConverter";
import { type EngineHabitRule, habitSummary } from "../progress";
import { GOAL_HABIT_LOG, GOAL_HABIT_RULE } from "../queries/goals";
import { CLOSED } from "../utils/goalValues";
import {
  addDays,
  checkPastDay,
  checkTimezone,
  isIsoDate,
  todayIn,
} from "../utils/localDates";
import { checkNumber, checkOptionalText } from "../utils/validation";

const MAX_NOTE = 500;

/** How far back ListGoalHabitLogs looks by default: the habit panel's twelve weeks. */
const DEFAULT_DAYS = 84;

type HabitGoal = {
  id: string;
  type: string;
  status: string;
  startDate: string;
  dueDate: string | null;
  closedOn: string | null;
  habitRule: GraphQlGoalHabitRule | null;
  habitLogs: GraphQlGoalHabitLog[];
};

/**
 * A habit goal's daily logs (ADR 0026): one per goal per local day, done or
 * a quantity. Every method checks the goal is the caller's live habit, so
 * another user's goal is simply not found.
 */
@Injectable()
export class GoalHabitService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * Logs a day, replacing any log already there. Omitted, the day is marked
   * done; a quantity alone records progress towards the rule's target.
   */
  async log(
    userId: string,
    goalId: string,
    date: string,
    log: BaseGoalHabitLog | undefined,
    tz: string,
  ): Promise<GoalHabitLog> {
    const today = todayIn(checkTimezone(tz));
    if (log !== undefined && (log === null || typeof log !== "object")) {
      throw new BadRequestException("goalHabitLog must be an object");
    }
    const input = (log ?? {}) as Record<string, unknown>;
    const problems: string[] = [];
    const logDate = checkPastDay(date, "date", today, problems);
    const quantity =
      input.quantity === undefined || input.quantity === null
        ? null
        : checkNumber(input.quantity, "quantity", problems, { min: 0 });
    let done = quantity === null;
    if (input.done !== undefined) {
      if (typeof input.done !== "boolean") {
        problems.push("done must be true or false");
      } else {
        done = input.done;
      }
    }
    const note = checkOptionalText(input.note, "note", MAX_NOTE, problems);
    if (!problems.length && !done && quantity === null) {
      problems.push(
        "a log records done or a quantity; delete the day's log to clear it",
      );
    }
    if (problems.length) throw new BadRequestException(problems);

    const goal = await this.goal(userId, goalId);
    checkDayInGoal(goal, logDate, problems);
    if (problems.length) throw new BadRequestException(problems);

    // An upsert on the day, so a day logged again keeps its created time.
    const document = gql`
      mutation LogGoalHabit($object: minerva_goal_habit_logs_insert_input!) {
        insert_minerva_goal_habit_logs_one(
          object: $object
          on_conflict: {
            constraint: goal_habit_logs_goal_id_log_date_key
            update_columns: [done, quantity, note]
          }
        ) {
          ${GOAL_HABIT_LOG}
        }
      }
    `;
    type Result = { insert_minerva_goal_habit_logs_one: GraphQlGoalHabitLog };
    const result = await this.graphQLClient.request<Result>(document, {
      object: { goalId, logDate, done, quantity, note },
    });
    return toDomainObject(
      result.insert_minerva_goal_habit_logs_one,
      engineRule(goal),
    );
  }

  /** Clears a day's log. */
  async deleteLog(
    userId: string,
    goalId: string,
    date: string,
    tz: string,
  ): Promise<void> {
    const today = todayIn(checkTimezone(tz));
    const problems: string[] = [];
    const logDate = checkPastDay(date, "date", today, problems);
    if (problems.length) throw new BadRequestException(problems);

    await this.goal(userId, goalId);
    const document = gql`
      mutation DeleteGoalHabitLog($goalId: uuid!, $logDate: date!) {
        delete_minerva_goal_habit_logs(
          where: { goalId: { _eq: $goalId }, logDate: { _eq: $logDate } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_goal_habit_logs: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      goalId,
      logDate,
    });
    if (result.delete_minerva_goal_habit_logs.affected_rows === 0) {
      throw new NotFoundException(`Goal ${goalId} has no log for ${logDate}`);
    }
  }

  /**
   * A habit's logs from `from` to `to` (the last twelve weeks by default),
   * with its adherence and streaks as of today.
   */
  async listLogs(
    userId: string,
    goalId: string,
    range: { from?: unknown; to?: unknown },
    tz: string,
  ): Promise<{ logs: GoalHabitLog[]; summary: GoalHabitSummary }> {
    const today = todayIn(checkTimezone(tz));
    const problems: string[] = [];
    const day = (value: unknown, name: string, fallback: string) => {
      if (value === undefined || value === "") return fallback;
      if (!isIsoDate(value)) {
        problems.push(`${name} must be a date written YYYY-MM-DD`);
        return fallback;
      }
      return value;
    };
    const to = day(range.to, "to", today);
    const from = day(range.from, "from", addDays(to, 1 - DEFAULT_DAYS));
    if (!problems.length && from > to) {
      problems.push("from must not be after to");
    }
    if (problems.length) throw new BadRequestException(problems);

    const goal = await this.goal(userId, goalId);
    const rule = engineRule(goal);
    const summary = habitSummary(
      rule,
      goal.habitLogs.map((l) => ({
        date: l.logDate,
        done: l.done,
        quantity: l.quantity === null ? undefined : Number(l.quantity),
      })),
      goal.startDate,
      today,
      [
        CLOSED.includes(goal.status as GoalStatus) ? goal.closedOn : null,
        goal.dueDate,
      ]
        .filter((d): d is string => d !== null)
        .sort()[0],
    );
    return {
      logs: goal.habitLogs
        .filter((l) => l.logDate >= from && l.logDate <= to)
        .map((l) => toDomainObject(l, rule)),
      summary,
    };
  }

  /** One of the user's live habit goals with its rule and every log, oldest first. */
  private async goal(userId: string, goalId: string): Promise<HabitGoal> {
    const document = gql`
      query ListGoalHabitLogs($userId: uuid!, $goalId: uuid!) {
        minerva_goals(
          where: {
            id: { _eq: $goalId }
            userId: { _eq: $userId }
            deletedTime: { _is_null: true }
          }
          limit: 1
        ) {
          id
          type
          status
          startDate
          dueDate
          closedOn
          habitRule {
            ${GOAL_HABIT_RULE}
          }
          habitLogs(order_by: { logDate: asc }) {
            ${GOAL_HABIT_LOG}
          }
        }
      }
    `;
    type Result = { minerva_goals: HabitGoal[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      goalId,
    });
    const goal = result.minerva_goals[0];
    if (!goal) throw new NotFoundException(`Goal with id ${goalId} not found`);
    if (goal.type !== GoalType.Habit || !goal.habitRule) {
      throw new BadRequestException("only habit goals have logs");
    }
    return goal;
  }
}

/** The habit's rule as the engine reads it. */
const engineRule = (goal: HabitGoal): EngineHabitRule => {
  const rule = goal.habitRule!;
  return {
    frequency: rule.frequency as EngineHabitRule["frequency"],
    timesPerPeriod: rule.timesPerPeriod,
    weekdays:
      rule.weekdays === null ? undefined : maskToWeekdays(rule.weekdays),
    quantityTarget:
      rule.quantityTarget === null ? undefined : Number(rule.quantityTarget),
  };
};

/** A day logged must fall in the goal's life: from its start, and not after it closed. */
const checkDayInGoal = (
  goal: HabitGoal,
  logDate: string,
  problems: string[],
): void => {
  if (logDate < goal.startDate) {
    problems.push(`date must not be before the goal starts, ${goal.startDate}`);
  }
  if (
    CLOSED.includes(goal.status as GoalStatus) &&
    goal.closedOn !== null &&
    logDate > goal.closedOn
  ) {
    problems.push(`date must not be after the goal closed, ${goal.closedOn}`);
  }
};
