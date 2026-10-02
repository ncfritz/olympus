import {
  GoalCheckin,
  GoalCheckinSource,
  GoalHealth,
} from "@ncfritz/olympus-model";
import moment from "moment";

export type GraphQlGoalCheckin = {
  id: string;
  goalId: string;
  checkinDate: string;
  /** Hasura sends `numeric` as a JSON number; a string is read as one too. */
  value: number | string | null;
  confidence: string | null;
  note: string | null;
  source: string;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export const toDomainObject = (input: GraphQlGoalCheckin): GoalCheckin => ({
  id: input.id,
  goalId: input.goalId,
  checkinDate: input.checkinDate,
  value: input.value === null ? undefined : Number(input.value),
  confidence: (input.confidence ?? undefined) as GoalHealth | undefined,
  note: input.note ?? undefined,
  source: input.source as GoalCheckinSource,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
