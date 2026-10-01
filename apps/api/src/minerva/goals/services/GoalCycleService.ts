import {
  BaseGoalCycle,
  GoalCycle,
  PartialGoalCycle,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  cycleEnds,
  GraphQlGoalCycle,
  toDomainObject,
} from "../converters/GoalCycleConverter";
import { isUniqueViolation } from "../utils/hasuraErrors";
import { GOAL_CYCLE } from "../queries/goalCycles";
import {
  checkTimezone,
  isIsoDate,
  isMonday,
  todayIn,
} from "../utils/localDates";
import { checkInteger, checkName } from "../utils/validation";

type CycleValues = {
  name: string;
  startDate: string;
  weeks: number;
  bufferWeeks: number;
};

/**
 * A user's 12-week cycles in Hasura (ADR 0026). Every method takes the
 * caller's user ID and scopes by it, and the caller's timezone, which
 * decides where today falls against each cycle.
 */
@Injectable()
export class GoalCycleService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** The user's cycles, latest first. */
  async list(userId: string, tz: string): Promise<GoalCycle[]> {
    const today = todayIn(checkTimezone(tz));
    const rows = await this.rows(userId);
    return rows.map((row) => toDomainObject(row, today));
  }

  /** One of the user's cycles. */
  async describe(
    userId: string,
    cycleId: string,
    tz: string,
  ): Promise<GoalCycle> {
    const today = todayIn(checkTimezone(tz));
    return toDomainObject(await this.row(userId, cycleId), today);
  }

  /** Adds a cycle; one overlapping another of the user's is a conflict. */
  async create(
    userId: string,
    cycle: BaseGoalCycle | undefined,
    tz: string,
  ): Promise<GoalCycle> {
    const today = todayIn(checkTimezone(tz));
    const values = validateBase(cycle);
    this.checkOverlap(values, undefined, await this.rows(userId));

    const document = gql`
      mutation CreateGoalCycle($object: minerva_goal_cycles_insert_input!) {
        insert_minerva_goal_cycles_one(object: $object) {
          ${GOAL_CYCLE}
        }
      }
    `;
    type Result = { insert_minerva_goal_cycles_one: GraphQlGoalCycle };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: { userId, ...values },
      });
      return toDomainObject(result.insert_minerva_goal_cycles_one, today);
    } catch (error) {
      if (isUniqueViolation(error)) throw overlap(values.startDate);
      throw error;
    }
  }

  /**
   * Renames a cycle or changes its dates. Answers `undefined` when the body
   * names nothing to change.
   */
  async update(
    userId: string,
    cycleId: string,
    changes: PartialGoalCycle | undefined,
    tz: string,
  ): Promise<GoalCycle | undefined> {
    const today = todayIn(checkTimezone(tz));
    const changed = validatePartial(changes);
    // First, so a missing cycle is a 404 before anything is written.
    const current = await this.row(userId, cycleId);
    if (Object.keys(changed).length === 0) return undefined;

    const set: Partial<CycleValues> = {};
    for (const key of ["name", "startDate", "weeks", "bufferWeeks"] as const) {
      if (changed[key] !== undefined && changed[key] !== current[key]) {
        (set as Record<string, unknown>)[key] = changed[key];
      }
    }
    if (Object.keys(set).length === 0) return toDomainObject(current, today);

    const next = { ...current, ...set };
    this.checkOverlap(next, cycleId, await this.rows(userId));

    const document = gql`
      mutation UpdateGoalCycle(
        $userId: uuid!
        $cycleId: uuid!
        $set: minerva_goal_cycles_set_input!
      ) {
        update_minerva_goal_cycles(
          where: { id: { _eq: $cycleId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${GOAL_CYCLE}
          }
        }
      }
    `;
    type Result = {
      update_minerva_goal_cycles: { returning: GraphQlGoalCycle[] };
    };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        userId,
        cycleId,
        set,
      });
      const row = result.update_minerva_goal_cycles.returning[0];
      if (!row) throw notFound(cycleId);
      return toDomainObject(row, today);
    } catch (error) {
      if (isUniqueViolation(error)) throw overlap(next.startDate);
      throw error;
    }
  }

  /**
   * Removes one of the user's cycles. Its goals keep their dates and become
   * custom goals, in the same transaction.
   */
  async delete(userId: string, cycleId: string): Promise<void> {
    const document = gql`
      mutation DeleteGoalCycle($userId: uuid!, $cycleId: uuid!) {
        update_minerva_goals(
          where: { cycleId: { _eq: $cycleId }, userId: { _eq: $userId } }
          _set: { cycleId: null, horizon: "custom" }
        ) {
          affected_rows
        }
        delete_minerva_goal_cycles(
          where: { id: { _eq: $cycleId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_goal_cycles: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      cycleId,
    });
    if (result.delete_minerva_goal_cycles.affected_rows === 0) {
      throw notFound(cycleId);
    }
  }

  private async rows(userId: string): Promise<GraphQlGoalCycle[]> {
    const document = gql`
      query ListGoalCycles($userId: uuid!) {
        minerva_goal_cycles(
          where: { userId: { _eq: $userId } }
          order_by: { startDate: desc }
        ) {
          ${GOAL_CYCLE}
        }
      }
    `;
    type Result = { minerva_goal_cycles: GraphQlGoalCycle[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
    });
    return result.minerva_goal_cycles;
  }

  private async row(
    userId: string,
    cycleId: string,
  ): Promise<GraphQlGoalCycle> {
    const document = gql`
      query DescribeGoalCycle($userId: uuid!, $cycleId: uuid!) {
        minerva_goal_cycles(
          where: { id: { _eq: $cycleId }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${GOAL_CYCLE}
        }
      }
    `;
    type Result = { minerva_goal_cycles: GraphQlGoalCycle[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      cycleId,
    });
    const row = result.minerva_goal_cycles[0];
    if (!row) throw notFound(cycleId);
    return row;
  }

  /**
   * A cycle, buffer weeks included, may not share a day with another of the
   * user's cycles: a week belongs to one cycle.
   */
  private checkOverlap(
    cycle: CycleValues,
    cycleId: string | undefined,
    existing: GraphQlGoalCycle[],
  ): void {
    const { bufferEndDate } = cycleEnds(
      cycle.startDate,
      cycle.weeks,
      cycle.bufferWeeks,
    );
    const clash = existing.find((other) => {
      if (other.id === cycleId) return false;
      const otherEnd = cycleEnds(
        other.startDate,
        other.weeks,
        other.bufferWeeks,
      ).bufferEndDate;
      return cycle.startDate <= otherEnd && other.startDate <= bufferEndDate;
    });
    if (clash) {
      throw new ConflictException(
        `The cycle would overlap ${clash.name}, which runs from ${clash.startDate}`,
      );
    }
  }
}

const notFound = (cycleId: string) =>
  new NotFoundException(`Goal cycle with id ${cycleId} not found`);

const overlap = (startDate: string) =>
  new ConflictException(`You already have a cycle starting ${startDate}`);

const checkStartDate = (value: unknown, problems: string[]): string => {
  if (!isIsoDate(value) || !isMonday(value)) {
    problems.push("startDate must be a Monday, written YYYY-MM-DD");
    return "";
  }
  return value;
};

const validateBase = (cycle: BaseGoalCycle | undefined): CycleValues => {
  if (!cycle || typeof cycle !== "object") {
    throw new BadRequestException("goalCycle is required");
  }
  const problems: string[] = [];
  const values: CycleValues = {
    name: checkName(cycle.name, problems),
    startDate: checkStartDate(cycle.startDate, problems),
    weeks:
      cycle.weeks === undefined
        ? 12
        : checkInteger(cycle.weeks, "weeks", 1, 26, problems),
    bufferWeeks:
      cycle.bufferWeeks === undefined
        ? 1
        : checkInteger(cycle.bufferWeeks, "bufferWeeks", 0, 2, problems),
  };
  if (problems.length) throw new BadRequestException(problems);
  return values;
};

const validatePartial = (
  changes: PartialGoalCycle | undefined,
): Partial<CycleValues> => {
  if (!changes || typeof changes !== "object") {
    throw new BadRequestException("goalCycle is required");
  }
  const problems: string[] = [];
  const changed: Partial<CycleValues> = {};
  if (changes.name !== undefined) {
    changed.name = checkName(changes.name, problems);
  }
  if (changes.startDate !== undefined) {
    changed.startDate = checkStartDate(changes.startDate, problems);
  }
  if (changes.weeks !== undefined) {
    changed.weeks = checkInteger(changes.weeks, "weeks", 1, 26, problems);
  }
  if (changes.bufferWeeks !== undefined) {
    changed.bufferWeeks = checkInteger(
      changes.bufferWeeks,
      "bufferWeeks",
      0,
      2,
      problems,
    );
  }
  if (problems.length) throw new BadRequestException(problems);
  return changed;
};
