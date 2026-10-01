import {
  BaseGoalCategory,
  GoalCategory,
  GoalCategoryIcon,
  PartialGoalCategory,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlGoalCategory,
  toDomainObject,
} from "../converters/GoalCategoryConverter";
import { isUniqueViolation } from "../utils/hasuraErrors";
import { GOAL_CATEGORY } from "../queries/goalCategories";
import {
  checkColor,
  checkEnum,
  checkName,
  checkOptionalText,
  isStringList,
  isUuid,
} from "../utils/validation";

const MAX_VISION = 2000;

/** The categories a user starts with, in order, with no visions. */
export const STARTER_CATEGORIES: ReadonlyArray<{
  name: string;
  color: string;
  icon: GoalCategoryIcon;
}> = [
  { name: "Health", color: "#52c41a", icon: GoalCategoryIcon.Heart },
  { name: "Work", color: "#1677ff", icon: GoalCategoryIcon.Laptop },
  { name: "Relationships", color: "#eb2f96", icon: GoalCategoryIcon.Team },
  { name: "Finance", color: "#faad14", icon: GoalCategoryIcon.Wallet },
  { name: "Learning", color: "#722ed1", icon: GoalCategoryIcon.Book },
  { name: "Home", color: "#13c2c2", icon: GoalCategoryIcon.Home },
];

type CategoryValues = {
  name: string;
  color: string;
  icon: GoalCategoryIcon;
  vision: string | null;
};

type CategorySet = Partial<CategoryValues> & { archivedTime?: string | null };

/**
 * A user's goal categories in Hasura (ADR 0026). Every method takes the
 * caller's user ID and scopes by it, so another user's category is simply
 * not found.
 */
@Injectable()
export class GoalCategoryService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The user's categories in their order, archived ones included. The first
   * time a user's categories are read they are given the starter set, once:
   * a user who later deletes them all keeps none.
   */
  async list(userId: string): Promise<GoalCategory[]> {
    const document = gql`
      query ListGoalCategories($userId: uuid!) {
        minerva_goal_categories(
          where: { userId: { _eq: $userId } }
          order_by: { position: asc }
        ) {
          ${GOAL_CATEGORY}
        }
        minerva_goal_user_settings_by_pk(userId: $userId) {
          starterCategoriesTime
        }
      }
    `;
    type Result = {
      minerva_goal_categories: GraphQlGoalCategory[];
      minerva_goal_user_settings_by_pk: {
        starterCategoriesTime: string | null;
      } | null;
    };
    const read = () => this.graphQLClient.request<Result>(document, { userId });

    let result = await read();
    if (result.minerva_goal_user_settings_by_pk === null) {
      await this.giveStarterCategories(userId, result.minerva_goal_categories);
      result = await read();
    }
    return result.minerva_goal_categories.map(toDomainObject);
  }

  /** One of the user's categories. */
  async describe(userId: string, categoryId: string): Promise<GoalCategory> {
    const document = gql`
      query DescribeGoalCategory($userId: uuid!, $categoryId: uuid!) {
        minerva_goal_categories(
          where: { id: { _eq: $categoryId }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${GOAL_CATEGORY}
        }
      }
    `;
    type Result = { minerva_goal_categories: GraphQlGoalCategory[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      categoryId,
    });
    const row = result.minerva_goal_categories[0];
    if (!row) throw notFound(categoryId);
    return toDomainObject(row);
  }

  /** Adds a category at the end of the user's list. */
  async create(
    userId: string,
    category: BaseGoalCategory | undefined,
  ): Promise<GoalCategory> {
    const values = validateBase(category);
    // Through list, so the starter set is given first and the new category
    // follows it rather than meeting it by name later.
    const current = await this.list(userId);
    const position = Math.max(-1, ...current.map((c) => c.position)) + 1;

    const document = gql`
      mutation CreateGoalCategory(
        $object: minerva_goal_categories_insert_input!
      ) {
        insert_minerva_goal_categories_one(object: $object) {
          ${GOAL_CATEGORY}
        }
      }
    `;
    type Result = { insert_minerva_goal_categories_one: GraphQlGoalCategory };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: { userId, ...values, position },
      });
      return toDomainObject(result.insert_minerva_goal_categories_one);
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate(values.name);
      throw error;
    }
  }

  /**
   * Changes a category: its name, colour, icon, vision, or whether it is
   * archived. Answers `undefined` when the body names nothing to change.
   */
  async update(
    userId: string,
    categoryId: string,
    changes: PartialGoalCategory | undefined,
  ): Promise<GoalCategory | undefined> {
    const changed = validatePartial(changes);
    // First, so a missing category is a 404 before anything is written.
    const current = await this.describe(userId, categoryId);
    if (Object.keys(changed).length === 0) return undefined;

    const set: CategorySet = {};
    if (changed.name !== undefined && changed.name !== current.name) {
      set.name = changed.name;
    }
    if (changed.color !== undefined && changed.color !== current.color) {
      set.color = changed.color;
    }
    if (changed.icon !== undefined && changed.icon !== current.icon) {
      set.icon = changed.icon;
    }
    if (
      changed.vision !== undefined &&
      changed.vision !== (current.vision ?? null)
    ) {
      set.vision = changed.vision;
    }
    if (
      changed.archived !== undefined &&
      changed.archived !== current.archived
    ) {
      set.archivedTime = changed.archived ? new Date().toISOString() : null;
    }
    if (Object.keys(set).length === 0) return current;

    const document = gql`
      mutation UpdateGoalCategory(
        $userId: uuid!
        $categoryId: uuid!
        $set: minerva_goal_categories_set_input!
      ) {
        update_minerva_goal_categories(
          where: { id: { _eq: $categoryId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${GOAL_CATEGORY}
          }
        }
      }
    `;
    type Result = {
      update_minerva_goal_categories: { returning: GraphQlGoalCategory[] };
    };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        userId,
        categoryId,
        set,
      });
      const row = result.update_minerva_goal_categories.returning[0];
      if (!row) throw notFound(categoryId);
      return toDomainObject(row);
    } catch (error) {
      if (isUniqueViolation(error) && set.name) throw duplicate(set.name);
      throw error;
    }
  }

  /**
   * Removes one of the user's categories. A category with goals, deleted
   * ones included, is removed only when `moveTo` names another of the
   * user's categories for them; they move in the same transaction.
   */
  async delete(
    userId: string,
    categoryId: string,
    moveTo?: unknown,
  ): Promise<void> {
    if (moveTo !== undefined && (!isUuid(moveTo) || moveTo === categoryId)) {
      throw new BadRequestException(
        "moveTo must be the ID of another of your categories",
      );
    }
    const useDocument = gql`
      query GetGoalCategoryUse(
        $userId: uuid!
        $categoryId: uuid!
        $moveTo: uuid!
      ) {
        category: minerva_goal_categories(
          where: { id: { _eq: $categoryId }, userId: { _eq: $userId } }
        ) {
          id
        }
        target: minerva_goal_categories(
          where: { id: { _eq: $moveTo }, userId: { _eq: $userId } }
        ) {
          id
          archivedTime
        }
        minerva_goals_aggregate(
          where: { categoryId: { _eq: $categoryId }, userId: { _eq: $userId } }
        ) {
          aggregate {
            count
          }
        }
      }
    `;
    type UseResult = {
      category: { id: string }[];
      target: { id: string; archivedTime: string | null }[];
      minerva_goals_aggregate: { aggregate: { count: number } };
    };
    const use = await this.graphQLClient.request<UseResult>(useDocument, {
      userId,
      categoryId,
      // A category ID that cannot exist, so the target comes back empty.
      moveTo: moveTo ?? categoryId,
    });
    if (use.category.length === 0) throw notFound(categoryId);
    const goals = use.minerva_goals_aggregate.aggregate.count;
    const move = moveTo !== undefined;
    if (goals > 0 && !move) {
      throw new ConflictException(
        `The category has ${goals} goal${goals === 1 ? "" : "s"}; name a category to move them to`,
      );
    }
    if (move && (use.target.length === 0 || use.target[0].archivedTime)) {
      throw new BadRequestException(
        "moveTo must name another of your categories that is not archived",
      );
    }

    const document = gql`
      mutation DeleteGoalCategory(
        $userId: uuid!
        $categoryId: uuid!
        $moveTo: uuid!
        $move: Boolean!
      ) {
        update_minerva_goals(
          where: { categoryId: { _eq: $categoryId }, userId: { _eq: $userId } }
          _set: { categoryId: $moveTo }
        ) @include(if: $move) {
          affected_rows
        }
        delete_minerva_goal_categories(
          where: { id: { _eq: $categoryId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_goal_categories: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      categoryId,
      moveTo: moveTo ?? categoryId,
      move,
    });
    if (result.delete_minerva_goal_categories.affected_rows === 0) {
      throw notFound(categoryId);
    }
  }

  /**
   * Puts the user's categories in the order given, which must name every
   * one of them, archived ones included, exactly once.
   */
  async reorder(
    userId: string,
    categoryIds: string[] | undefined,
  ): Promise<GoalCategory[]> {
    if (!isStringList(categoryIds)) {
      throw new BadRequestException("categoryIds must be a list of IDs");
    }
    const current = await this.list(userId);
    const given = new Set(categoryIds);
    if (
      given.size !== categoryIds.length ||
      given.size !== current.length ||
      current.some((category) => !given.has(category.id))
    ) {
      throw new BadRequestException(
        "categoryIds must name each of your categories exactly once",
      );
    }

    // The position constraint is deferred, so the rows may collide on the
    // way to their new places and are checked when the mutation commits.
    const document = gql`
      mutation ReorderGoalCategories(
        $updates: [minerva_goal_categories_updates!]!
      ) {
        update_minerva_goal_categories_many(updates: $updates) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      updates: categoryIds.map((id, position) => ({
        where: { id: { _eq: id }, userId: { _eq: userId } },
        _set: { position },
      })),
    });
    return this.list(userId);
  }

  /**
   * Records the user's settings and inserts the starter categories after
   * any they already have, in one transaction. A concurrent first read that
   * got there first makes the settings insert a conflict, and this one
   * gives nothing.
   */
  private async giveStarterCategories(
    userId: string,
    existing: GraphQlGoalCategory[],
  ): Promise<void> {
    const taken = new Set(existing.map((c) => c.name.toLowerCase()));
    const first = Math.max(-1, ...existing.map((c) => c.position)) + 1;
    const objects = STARTER_CATEGORIES.filter(
      (c) => !taken.has(c.name.toLowerCase()),
    ).map((c, index) => ({ userId, ...c, position: first + index }));

    const document = gql`
      mutation GiveStarterGoalCategories(
        $settings: minerva_goal_user_settings_insert_input!
        $objects: [minerva_goal_categories_insert_input!]!
      ) {
        insert_minerva_goal_user_settings_one(object: $settings) {
          userId
        }
        insert_minerva_goal_categories(objects: $objects) {
          affected_rows
        }
      }
    `;
    try {
      await this.graphQLClient.request(document, {
        settings: { userId, starterCategoriesTime: new Date().toISOString() },
        objects,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
}

const notFound = (categoryId: string) =>
  new NotFoundException(`Goal category with id ${categoryId} not found`);

const duplicate = (name: string) =>
  new ConflictException(`You already have a goal category named ${name}`);

const validateBase = (
  category: BaseGoalCategory | undefined,
): CategoryValues => {
  if (!category || typeof category !== "object") {
    throw new BadRequestException("goalCategory is required");
  }
  const problems: string[] = [];
  const values: CategoryValues = {
    name: checkName(category.name, problems),
    color: checkColor(category.color, problems),
    icon: checkEnum(category.icon, GoalCategoryIcon, "icon", problems),
    vision: checkOptionalText(category.vision, "vision", MAX_VISION, problems),
  };
  if (problems.length) throw new BadRequestException(problems);
  return values;
};

const validatePartial = (
  changes: PartialGoalCategory | undefined,
): Partial<CategoryValues> & { archived?: boolean } => {
  if (!changes || typeof changes !== "object") {
    throw new BadRequestException("goalCategory is required");
  }
  const problems: string[] = [];
  const changed: Partial<CategoryValues> & { archived?: boolean } = {};
  if (changes.name !== undefined) {
    changed.name = checkName(changes.name, problems);
  }
  if (changes.color !== undefined) {
    changed.color = checkColor(changes.color, problems);
  }
  if (changes.icon !== undefined) {
    changed.icon = checkEnum(changes.icon, GoalCategoryIcon, "icon", problems);
  }
  if (changes.vision !== undefined) {
    changed.vision = checkOptionalText(
      changes.vision,
      "vision",
      MAX_VISION,
      problems,
    );
  }
  if (changes.archived !== undefined) {
    if (typeof changes.archived !== "boolean") {
      problems.push("archived must be true or false");
    } else {
      changed.archived = changes.archived;
    }
  }
  if (problems.length) throw new BadRequestException(problems);
  return changed;
};
