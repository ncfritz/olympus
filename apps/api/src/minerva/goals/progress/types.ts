import type {
  GoalHealth,
  GoalProgressMode,
  GoalRollup,
  GoalStatus,
  GoalType,
  HabitFrequency,
} from "@ncfritz/olympus-model";
import type { IsoDate } from "../utils/localDates";

/** A check-in as the engine needs it (the table arrives in phase 4). */
export type EngineCheckin = {
  date: IsoDate;
  value?: number;
  confidence?: GoalHealth;
  /** Orders check-ins on the same date: later wins. */
  createdTime: string;
};

/** A habit log: one per goal per local day. */
export type EngineHabitLog = {
  date: IsoDate;
  done: boolean;
  quantity?: number;
};

export type EngineHabitRule = {
  frequency: HabitFrequency;
  timesPerPeriod: number;
  /** ISO weekdays, 1 (Monday) to 7 (Sunday). */
  weekdays?: number[];
  quantityTarget?: number;
};

export type EngineMilestone = { weight: number; done: boolean };

/** Everything the engine reads about one goal. */
export type EngineGoal = {
  id: string;
  parentId?: string;
  deleted: boolean;
  type: GoalType;
  status: GoalStatus;
  progressMode: GoalProgressMode;
  rollup?: GoalRollup;
  weight: number;
  manualProgress?: number;
  startDate: IsoDate;
  dueDate?: IsoDate;
  unit?: string;
  startValue?: number;
  targetValue?: number;
  tolerancePct: number;
  milestones: EngineMilestone[];
  habitRule?: EngineHabitRule;
  checkins: EngineCheckin[];
  habitLogs: EngineHabitLog[];
};

/** What the engine works out for a goal, for a given day. */
export type GoalProgress = {
  /** 0 to 100, to one decimal place. */
  progress: number;
  /** An outcome goal's current value. */
  currentValue?: number;
  /** Where pace says the goal should be, 0 to 100, to one decimal place. */
  expectedProgress?: number;
  /** For active goals only. */
  health?: GoalHealth;
};
