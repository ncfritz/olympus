import { GoalCategory, GoalCategoryIcon } from "@ncfritz/olympus-model";
import moment from "moment";

/** A `minerva.goal_categories` row as Hasura returns it (custom column names). */
export type GraphQlGoalCategory = {
  id: string;
  name: string;
  color: string;
  icon: string;
  vision: string | null;
  position: number;
  archivedTime: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export const toDomainObject = (input: GraphQlGoalCategory): GoalCategory => ({
  id: input.id,
  name: input.name,
  color: input.color,
  icon: input.icon as GoalCategoryIcon,
  vision: input.vision ?? undefined,
  position: input.position,
  archived: input.archivedTime !== null,
  archivedTime: input.archivedTime ? moment(input.archivedTime) : undefined,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
