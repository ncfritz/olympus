import {
  BaseGoalCheckin,
  GoalCheckin,
  GoalCheckinSource,
  GoalHealth,
  GoalStatus,
  GoalType,
  PartialGoalCheckin,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  type GraphQlGoalCheckin,
  toDomainObject,
} from "../converters/GoalCheckinConverter";
import { GOAL_CHECKIN } from "../queries/goals";
import { CLOSED } from "../utils/goalValues";
import { checkPastDay, checkTimezone, todayIn } from "../utils/localDates";
import { checkEnum, checkNumber, checkOptionalText } from "../utils/validation";

const MAX_NOTE = 2000;

/** The goal a check-in is on, with its check-ins latest first. */
type CheckinGoal = {
  id: string;
  type: string;
  status: string;
  startDate: string;
  checkins: GraphQlGoalCheckin[];
};

/** A check-in's columns as checked. */
type CheckinValues = {
  checkinDate: string;
  value: number | null;
  confidence: GoalHealth | null;
  note: string | null;
};

/**
 * Check-ins on a user's goals (ADR 0026): a value, a confidence or both
 * for a day. Every method checks the goal is the caller's and not deleted,
 * so another user's goal or check-in is simply not found.
 */
@Injectable()
export class GoalCheckinService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** A goal's check-ins, latest first. */
  async list(userId: string, goalId: string): Promise<GoalCheckin[]> {
    return (await this.goal(userId, goalId)).checkins.map(toDomainObject);
  }

  /**
   * Checks in on an open goal. An outcome goal's check-in needs a value;
   * any other goal's needs a confidence and has no value.
   */
  async create(
    userId: string,
    goalId: string,
    checkin: BaseGoalCheckin | undefined,
    tz: string,
  ): Promise<GoalCheckin> {
    const today = todayIn(checkTimezone(tz));
    if (!checkin || typeof checkin !== "object") {
      throw new BadRequestException("goalCheckin is required");
    }
    const problems: string[] = [];
    const input = checkin as Record<string, unknown>;
    const values: CheckinValues = {
      checkinDate:
        input.checkinDate === undefined
          ? today
          : checkPastDay(input.checkinDate, "checkinDate", today, problems),
      value: checkValue(input.value, problems),
      confidence: checkConfidence(input.confidence, problems),
      note: checkOptionalText(input.note, "note", MAX_NOTE, problems),
    };
    const source =
      input.source === undefined
        ? GoalCheckinSource.Goal
        : checkEnum(input.source, GoalCheckinSource, "source", problems);
    if (problems.length) throw new BadRequestException(problems);

    const goal = await this.goal(userId, goalId);
    checkOpen(goal);
    checkTogether(goal, values, problems);
    if (problems.length) throw new BadRequestException(problems);

    const document = gql`
      mutation CreateGoalCheckin($object: minerva_goal_checkins_insert_input!) {
        insert_minerva_goal_checkins_one(object: $object) {
          ${GOAL_CHECKIN}
        }
      }
    `;
    type Result = { insert_minerva_goal_checkins_one: GraphQlGoalCheckin };
    const result = await this.graphQLClient.request<Result>(document, {
      object: { goalId, ...values, source },
    });
    return toDomainObject(result.insert_minerva_goal_checkins_one);
  }

  /**
   * Changes a check-in; the check-in as it would stand must still be valid.
   * Answers `undefined` when the request names nothing to change.
   */
  async update(
    userId: string,
    goalId: string,
    checkinId: string,
    changes: PartialGoalCheckin | undefined,
    tz: string,
  ): Promise<GoalCheckin | undefined> {
    const today = todayIn(checkTimezone(tz));
    if (!changes || typeof changes !== "object") {
      throw new BadRequestException("goalCheckin is required");
    }
    const input = changes as Record<string, unknown>;
    const problems: string[] = [];
    const named: Partial<CheckinValues> = {};
    if (input.checkinDate !== undefined) {
      named.checkinDate = checkPastDay(
        input.checkinDate,
        "checkinDate",
        today,
        problems,
      );
    }
    if (input.value !== undefined)
      named.value = checkValue(input.value, problems);
    if (input.confidence !== undefined) {
      named.confidence = checkConfidence(input.confidence, problems);
    }
    if (input.note !== undefined) {
      named.note = checkOptionalText(input.note, "note", MAX_NOTE, problems);
    }
    if (problems.length) throw new BadRequestException(problems);

    const goal = await this.goal(userId, goalId);
    const row = goal.checkins.find((c) => c.id === checkinId);
    if (!row) throw checkinNotFound(checkinId);
    if (Object.keys(named).length === 0) return undefined;

    const current: CheckinValues = {
      checkinDate: row.checkinDate,
      value: row.value === null ? null : Number(row.value),
      confidence: row.confidence as GoalHealth | null,
      note: row.note,
    };
    const merged = { ...current, ...named };
    checkTogether(goal, merged, problems);
    if (problems.length) throw new BadRequestException(problems);

    const set: Partial<CheckinValues> = {};
    for (const key of Object.keys(named) as (keyof CheckinValues)[]) {
      if (merged[key] !== current[key]) {
        (set as Record<string, unknown>)[key] = merged[key];
      }
    }
    if (Object.keys(set).length === 0) return toDomainObject(row);

    const document = gql`
      mutation UpdateGoalCheckin(
        $goalId: uuid!
        $checkinId: uuid!
        $set: minerva_goal_checkins_set_input!
      ) {
        update_minerva_goal_checkins(
          where: { id: { _eq: $checkinId }, goalId: { _eq: $goalId } }
          _set: $set
        ) {
          returning {
            ${GOAL_CHECKIN}
          }
        }
      }
    `;
    type Result = {
      update_minerva_goal_checkins: { returning: GraphQlGoalCheckin[] };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      goalId,
      checkinId,
      set,
    });
    const updated = result.update_minerva_goal_checkins.returning[0];
    if (!updated) throw checkinNotFound(checkinId);
    return toDomainObject(updated);
  }

  /** Removes a check-in from a goal. */
  async delete(
    userId: string,
    goalId: string,
    checkinId: string,
  ): Promise<void> {
    await this.goal(userId, goalId);
    const document = gql`
      mutation DeleteGoalCheckin($goalId: uuid!, $checkinId: uuid!) {
        delete_minerva_goal_checkins(
          where: { id: { _eq: $checkinId }, goalId: { _eq: $goalId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_goal_checkins: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      goalId,
      checkinId,
    });
    if (result.delete_minerva_goal_checkins.affected_rows === 0) {
      throw checkinNotFound(checkinId);
    }
  }

  /** One of the user's live goals with its check-ins, latest first. */
  private async goal(userId: string, goalId: string): Promise<CheckinGoal> {
    const document = gql`
      query ListGoalCheckins($userId: uuid!, $goalId: uuid!) {
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
          checkins(
            order_by: [{ checkinDate: desc }, { createdTime: desc }]
          ) {
            ${GOAL_CHECKIN}
          }
        }
      }
    `;
    type Result = { minerva_goals: CheckinGoal[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      goalId,
    });
    const goal = result.minerva_goals[0];
    if (!goal) throw new NotFoundException(`Goal with id ${goalId} not found`);
    return goal;
  }
}

const checkinNotFound = (checkinId: string) =>
  new NotFoundException(`Goal check-in with id ${checkinId} not found`);

const checkValue = (value: unknown, problems: string[]): number | null =>
  value === undefined || value === null
    ? null
    : checkNumber(value, "value", problems);

const checkConfidence = (
  value: unknown,
  problems: string[],
): GoalHealth | null =>
  value === undefined || value === null
    ? null
    : checkEnum(value, GoalHealth, "confidence", problems);

/** A closed goal takes no new check-ins; its record is kept as it closed. */
const checkOpen = (goal: CheckinGoal): void => {
  if (CLOSED.includes(goal.status as GoalStatus)) {
    throw new ConflictException(
      "The goal is closed; reopen it to check in again",
    );
  }
};

/** The rules between a check-in's fields and its goal. */
const checkTogether = (
  goal: CheckinGoal,
  values: CheckinValues,
  problems: string[],
): void => {
  if (goal.type === GoalType.Outcome) {
    if (values.value === null) {
      problems.push("a check-in on an outcome goal needs a value");
    }
  } else {
    if (values.value !== null) {
      problems.push("only outcome goals take a value");
    }
    if (values.confidence === null) {
      problems.push("a check-in needs a confidence");
    }
  }
  if (values.checkinDate < goal.startDate) {
    problems.push(
      `checkinDate must not be before the goal starts, ${goal.startDate}`,
    );
  }
};
