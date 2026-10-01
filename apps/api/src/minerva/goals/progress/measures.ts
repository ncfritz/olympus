import { GoalHealth } from "@ncfritz/olympus-model";
import { daysBetween, type IsoDate } from "../utils/localDates";
import type { EngineCheckin, EngineMilestone } from "./types";

/** A number held to 0–100 and one decimal place. */
export const percent = (value: number): number =>
  Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

/**
 * How far a value has come from start towards target, 0 to 100. Works in
 * either direction: a target below the start is a goal going down. Past the
 * target is 100; the wrong way is 0.
 */
export const outcomeProgress = (
  startValue: number,
  targetValue: number,
  currentValue: number,
): number =>
  percent(((currentValue - startValue) / (targetValue - startValue)) * 100);

/** The weighted share of milestones done, 0 to 100; none is 0. */
export const milestoneProgress = (milestones: EngineMilestone[]): number => {
  const total = milestones.reduce((sum, m) => sum + m.weight, 0);
  if (total === 0) return 0;
  const done = milestones
    .filter((m) => m.done)
    .reduce((sum, m) => sum + m.weight, 0);
  return percent((done / total) * 100);
};

/** The latest check-in by date, then by when it was written. */
export const latestCheckin = (
  checkins: EngineCheckin[],
  having: (checkin: EngineCheckin) => boolean = () => true,
): EngineCheckin | undefined =>
  checkins
    .filter(having)
    .reduce<EngineCheckin | undefined>(
      (latest, c) =>
        !latest ||
        c.date > latest.date ||
        (c.date === latest.date && c.createdTime > latest.createdTime)
          ? c
          : latest,
      undefined,
    );

/**
 * Where a straight line from start to due puts a goal today, 0 to 100. The
 * start day is 0 and the due day is 100; a goal due the day it starts is
 * 100 from then.
 */
export const pace = (
  startDate: IsoDate,
  dueDate: IsoDate,
  today: IsoDate,
): number => {
  const span = daysBetween(startDate, dueDate);
  if (span <= 0) return today >= startDate ? 100 : 0;
  return percent((daysBetween(startDate, today) / span) * 100);
};

/**
 * Health from progress against pace: within the tolerance is on track,
 * within twice it at risk, further behind off track.
 */
export const paceHealth = (
  progress: number,
  expected: number,
  tolerancePct: number,
): GoalHealth => {
  const behind = expected - progress;
  if (behind <= tolerancePct) return GoalHealth.OnTrack;
  if (behind <= tolerancePct * 2) return GoalHealth.AtRisk;
  return GoalHealth.OffTrack;
};

/** Health from a habit's adherence: 80 % and up on track, 60 % at risk. */
export const habitHealth = (adherence: number): GoalHealth => {
  if (adherence >= 80) return GoalHealth.OnTrack;
  if (adherence >= 60) return GoalHealth.AtRisk;
  return GoalHealth.OffTrack;
};
