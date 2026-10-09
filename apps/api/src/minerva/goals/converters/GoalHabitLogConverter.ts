import { GoalHabitLog } from "@ncfritz/olympus-model";
import moment from "moment";
import { type EngineHabitRule, isMet } from "../progress";

export type GraphQlGoalHabitLog = {
  id: string;
  goalId: string;
  logDate: string;
  done: boolean;
  /** Hasura sends `numeric` as a JSON number; a string is read as one too. */
  quantity: number | string | null;
  note: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

/** A log, with whether it counts under the habit's rule. */
export const toDomainObject = (
  input: GraphQlGoalHabitLog,
  rule: EngineHabitRule | undefined,
): GoalHabitLog => {
  const quantity = input.quantity === null ? undefined : Number(input.quantity);
  return {
    id: input.id,
    goalId: input.goalId,
    logDate: input.logDate,
    done: input.done,
    quantity,
    note: input.note ?? undefined,
    met: rule
      ? isMet({ date: input.logDate, done: input.done, quantity }, rule)
      : input.done,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: input.lastUpdatedTime
      ? moment(input.lastUpdatedTime)
      : undefined,
  };
};
