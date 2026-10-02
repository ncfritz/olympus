import {
  BaseGoalMilestone,
  GoalMilestone,
  GoalType,
  PartialGoalMilestone,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  type GraphQlGoalMilestone,
  toMilestone,
} from "../converters/GoalConverter";
import { GOAL_MILESTONE } from "../queries/goals";
import {
  checkDate,
  checkIdList,
  checkMilestone,
  checkTitle,
} from "../utils/goalValues";
import { checkNumber } from "../../utils/validation";

type MilestoneGoal = {
  id: string;
  type: string;
  milestones: GraphQlGoalMilestone[];
};

/**
 * The milestones of a user's goals (ADR 0026). Every method takes the
 * caller's user ID and checks the goal is theirs and live, so another
 * user's goal or milestone is simply not found.
 */
@Injectable()
export class GoalMilestoneService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Adds a milestone at the end of a milestone goal's list. */
  async create(
    userId: string,
    goalId: string,
    milestone: BaseGoalMilestone | undefined,
  ): Promise<GoalMilestone> {
    if (!milestone || typeof milestone !== "object") {
      throw new BadRequestException("goalMilestone is required");
    }
    const problems: string[] = [];
    const values = checkMilestone(milestone, "goalMilestone", problems);
    if (problems.length) throw new BadRequestException(problems);

    const goal = await this.goal(userId, goalId);
    if (goal.type !== GoalType.Milestone) {
      throw new BadRequestException("only milestone goals have milestones");
    }
    const document = gql`
      mutation CreateGoalMilestone(
        $object: minerva_goal_milestones_insert_input!
      ) {
        insert_minerva_goal_milestones_one(object: $object) {
          ${GOAL_MILESTONE}
        }
      }
    `;
    type Result = { insert_minerva_goal_milestones_one: GraphQlGoalMilestone };
    const result = await this.graphQLClient.request<Result>(document, {
      object: {
        goalId,
        ...values,
        position: Math.max(-1, ...goal.milestones.map((m) => m.position)) + 1,
      },
    });
    return toMilestone(result.insert_minerva_goal_milestones_one);
  }

  /**
   * Renames, redates or reweighs a milestone, or ticks it done or not.
   * Answers `undefined` when the body names nothing to change.
   */
  async update(
    userId: string,
    goalId: string,
    milestoneId: string,
    changes: PartialGoalMilestone | undefined,
  ): Promise<GoalMilestone | undefined> {
    if (!changes || typeof changes !== "object") {
      throw new BadRequestException("goalMilestone is required");
    }
    const problems: string[] = [];
    const changed: {
      title?: string;
      dueDate?: string | null;
      weight?: number;
      done?: boolean;
    } = {};
    if (changes.title !== undefined) {
      changed.title = checkTitle(changes.title, problems);
    }
    if (changes.dueDate !== undefined) {
      changed.dueDate = checkDate(changes.dueDate, "dueDate", problems, false);
    }
    if (changes.weight !== undefined) {
      changed.weight = checkNumber(changes.weight, "weight", problems, {
        min: 0,
        max: 1000,
        exclusiveMin: true,
      });
    }
    if (changes.done !== undefined) {
      if (typeof changes.done !== "boolean") {
        problems.push("done must be true or false");
      } else {
        changed.done = changes.done;
      }
    }
    if (problems.length) throw new BadRequestException(problems);

    const goal = await this.goal(userId, goalId);
    const current = goal.milestones.find((m) => m.id === milestoneId);
    if (!current) throw milestoneNotFound(milestoneId);
    if (Object.keys(changed).length === 0) return undefined;

    const set: Record<string, unknown> = {};
    if (changed.title !== undefined && changed.title !== current.title) {
      set.title = changed.title;
    }
    if (changed.dueDate !== undefined && changed.dueDate !== current.dueDate) {
      set.dueDate = changed.dueDate;
    }
    if (
      changed.weight !== undefined &&
      changed.weight !== Number(current.weight)
    ) {
      set.weight = changed.weight;
    }
    if (
      changed.done !== undefined &&
      changed.done !== (current.doneTime !== null)
    ) {
      set.doneTime = changed.done ? new Date().toISOString() : null;
    }
    if (Object.keys(set).length === 0) return toMilestone(current);

    const document = gql`
      mutation UpdateGoalMilestone(
        $goalId: uuid!
        $milestoneId: uuid!
        $set: minerva_goal_milestones_set_input!
      ) {
        update_minerva_goal_milestones(
          where: { id: { _eq: $milestoneId }, goalId: { _eq: $goalId } }
          _set: $set
        ) {
          returning {
            ${GOAL_MILESTONE}
          }
        }
      }
    `;
    type Result = {
      update_minerva_goal_milestones: { returning: GraphQlGoalMilestone[] };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      goalId,
      milestoneId,
      set,
    });
    const row = result.update_minerva_goal_milestones.returning[0];
    if (!row) throw milestoneNotFound(milestoneId);
    return toMilestone(row);
  }

  /** Removes a milestone from a goal. */
  async delete(
    userId: string,
    goalId: string,
    milestoneId: string,
  ): Promise<void> {
    await this.goal(userId, goalId);
    const document = gql`
      mutation DeleteGoalMilestone($goalId: uuid!, $milestoneId: uuid!) {
        delete_minerva_goal_milestones(
          where: { id: { _eq: $milestoneId }, goalId: { _eq: $goalId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_goal_milestones: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      goalId,
      milestoneId,
    });
    if (result.delete_minerva_goal_milestones.affected_rows === 0) {
      throw milestoneNotFound(milestoneId);
    }
  }

  /**
   * Puts a goal's milestones in the order given, which must name every one
   * of them exactly once.
   */
  async reorder(
    userId: string,
    goalId: string,
    milestoneIds: unknown,
  ): Promise<GoalMilestone[]> {
    const problems: string[] = [];
    const ids = checkIdList(milestoneIds, "milestoneIds", problems);
    if (problems.length) throw new BadRequestException(problems);

    const goal = await this.goal(userId, goalId);
    const have = new Set(goal.milestones.map((m) => m.id));
    if (ids.length !== have.size || ids.some((id) => !have.has(id))) {
      throw new BadRequestException(
        "milestoneIds must name each of the goal's milestones exactly once",
      );
    }
    // The position constraint is deferred, so the rows may collide on the
    // way to their new places and are checked when the mutation commits.
    const document = gql`
      mutation ReorderGoalMilestones(
        $updates: [minerva_goal_milestones_updates!]!
      ) {
        update_minerva_goal_milestones_many(updates: $updates) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      updates: ids.map((id, position) => ({
        where: { id: { _eq: id }, goalId: { _eq: goalId } },
        _set: { position },
      })),
    });
    return (await this.goal(userId, goalId)).milestones.map(toMilestone);
  }

  /** One of the user's live goals with its milestones. */
  private async goal(userId: string, goalId: string): Promise<MilestoneGoal> {
    const document = gql`
      query DescribeGoalMilestones($userId: uuid!, $goalId: uuid!) {
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
          milestones(order_by: { position: asc }) {
            ${GOAL_MILESTONE}
          }
        }
      }
    `;
    type Result = { minerva_goals: MilestoneGoal[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      goalId,
    });
    const goal = result.minerva_goals[0];
    if (!goal) {
      throw new NotFoundException(`Goal with id ${goalId} not found`);
    }
    return goal;
  }
}

const milestoneNotFound = (milestoneId: string) =>
  new NotFoundException(`Goal milestone with id ${milestoneId} not found`);
