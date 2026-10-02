import { GoalCycle, GoalCycleStatus } from "@ncfritz/olympus-model";
import moment from "moment";
import { addDays, daysBetween, type IsoDate } from "../../utils/localDates";

/** A `minerva.goal_cycles` row as Hasura returns it (custom column names). */
export type GraphQlGoalCycle = {
  id: string;
  name: string;
  startDate: string;
  weeks: number;
  bufferWeeks: number;
  createdTime: string;
  lastUpdatedTime: string | null;
};

/** The last day of a cycle's execution weeks, and of its buffer weeks. */
export const cycleEnds = (
  startDate: IsoDate,
  weeks: number,
  bufferWeeks: number,
): { endDate: IsoDate; bufferEndDate: IsoDate } => {
  const endDate = addDays(startDate, weeks * 7 - 1);
  return { endDate, bufferEndDate: addDays(endDate, bufferWeeks * 7) };
};

/** The cycle as the model has it, with where `today` falls against it. */
export const toDomainObject = (
  input: GraphQlGoalCycle,
  today: IsoDate,
): GoalCycle => {
  const { endDate, bufferEndDate } = cycleEnds(
    input.startDate,
    input.weeks,
    input.bufferWeeks,
  );
  const sinceStart = daysBetween(input.startDate, today);
  let status: GoalCycleStatus;
  if (sinceStart < 0) status = GoalCycleStatus.Upcoming;
  else if (today <= endDate) status = GoalCycleStatus.Current;
  else if (today <= bufferEndDate) status = GoalCycleStatus.Buffer;
  else status = GoalCycleStatus.Past;
  const inCycle =
    status === GoalCycleStatus.Current || status === GoalCycleStatus.Buffer;

  return {
    id: input.id,
    name: input.name,
    startDate: input.startDate,
    weeks: input.weeks,
    bufferWeeks: input.bufferWeeks,
    endDate,
    bufferEndDate,
    status,
    currentWeek: inCycle ? Math.floor(sinceStart / 7) + 1 : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: input.lastUpdatedTime
      ? moment(input.lastUpdatedTime)
      : undefined,
  };
};
