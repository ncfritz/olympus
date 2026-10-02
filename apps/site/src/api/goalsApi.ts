import {
  type BaseGoalCategory,
  type BaseGoalCheckin,
  type BaseGoalHabitLog,
  type BaseGoalMilestone,
  client,
  closeGoal,
  createGoal,
  type CreateGoalRequest,
  createGoalCategory,
  createGoalCheckin,
  createGoalMilestone,
  deleteGoal,
  deleteGoalCategory,
  deleteGoalCheckin,
  deleteGoalHabitLog,
  deleteGoalMilestone,
  describeGoal,
  type FullGoal,
  type Goal,
  type GoalCategory,
  type GoalCheckin,
  type GoalCheckinSuggestion,
  type GoalClose,
  type GoalCycle,
  type GoalExecution,
  type GoalHabitDay,
  type GoalHabitLog,
  type GoalHabitSummary,
  type GoalMilestone,
  getGoalExecution,
  listGoalCategories,
  listGoalCheckins,
  listGoalCycles,
  listGoalHabitLogs,
  listGoalHabitsForDay,
  listGoals,
  logGoalHabit,
  type PartialGoalCategory,
  type PartialGoalCheckin,
  type PartialGoalMilestone,
  reorderGoalCategories,
  reorderGoalMilestones,
  reorderGoals,
  restoreGoal,
  suggestGoalCheckin,
  updateGoal,
  updateGoalCategory,
  type UpdateGoalRequest,
  updateGoalCheckin,
  updateGoalMilestone,
} from "@ncfritz/olympus-sdk/minerva";

/** ListGoals' filters, as the API takes them. */
export type GoalFilters = {
  /** Statuses, comma-separated; the open ones when absent. */
  status?: string;
  categoryId?: string;
  cycleId?: string;
  horizon?: string;
  tagId?: string;
  /** A goal's ID, or none for top-level goals. */
  parentId?: string;
};

/**
 * Goals through the API (ADR 0026). Every call is the signed-in user's,
 * and every one that depends on today sends the browser's timezone, so a
 * habit day or a check-in date is the user's own day.
 */
class GoalsApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  private get tz() {
    return {
      headers: {
        "x-ncfritz-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  /* Goals ---------------------------------------------------------------- */

  async listGoals(filters: GoalFilters = {}): Promise<Goal[]> {
    const { data } = await listGoals({ query: filters, ...this.tz });
    return data.goals;
  }

  async describeGoal(goalId: string): Promise<FullGoal> {
    const { data } = await describeGoal({ path: { goalId }, ...this.tz });
    return data.goal;
  }

  async createGoal(request: CreateGoalRequest): Promise<FullGoal> {
    const { data } = await createGoal({ body: request, ...this.tz });
    return data.goal;
  }

  /** The goal with the changes applied, or undefined when nothing changed. */
  async updateGoal(
    goalId: string,
    request: UpdateGoalRequest,
  ): Promise<FullGoal | undefined> {
    const response = await updateGoal({
      path: { goalId },
      body: request,
      ...this.tz,
      validateStatus: (status) => status === 200 || status === 304,
    });
    return response.status === 304 ? undefined : response.data.goal;
  }

  async deleteGoal(goalId: string): Promise<void> {
    await deleteGoal({ path: { goalId } });
  }

  async restoreGoal(goalId: string): Promise<FullGoal> {
    const { data } = await restoreGoal({ path: { goalId }, ...this.tz });
    return data.goal;
  }

  async reorderGoals(goalIds: string[]): Promise<Goal[]> {
    const { data } = await reorderGoals({ body: { goalIds }, ...this.tz });
    return data.goals;
  }

  async closeGoal(goalId: string, goalClose: GoalClose): Promise<FullGoal> {
    const { data } = await closeGoal({
      path: { goalId },
      body: { goalClose },
      ...this.tz,
    });
    return data.goal;
  }

  /* Milestones ----------------------------------------------------------- */

  async createMilestone(
    goalId: string,
    goalMilestone: BaseGoalMilestone,
  ): Promise<GoalMilestone> {
    const { data } = await createGoalMilestone({
      path: { goalId },
      body: { goalMilestone },
    });
    return data.goalMilestone;
  }

  async updateMilestone(
    goalId: string,
    milestoneId: string,
    goalMilestone: PartialGoalMilestone,
  ): Promise<void> {
    await updateGoalMilestone({
      path: { goalId, milestoneId },
      body: { goalMilestone },
      validateStatus: (status) => status === 200 || status === 304,
    });
  }

  async deleteMilestone(goalId: string, milestoneId: string): Promise<void> {
    await deleteGoalMilestone({ path: { goalId, milestoneId } });
  }

  async reorderMilestones(
    goalId: string,
    milestoneIds: string[],
  ): Promise<GoalMilestone[]> {
    const { data } = await reorderGoalMilestones({
      path: { goalId },
      body: { milestoneIds },
    });
    return data.goalMilestones;
  }

  /* Check-ins ------------------------------------------------------------ */

  async listCheckins(goalId: string): Promise<GoalCheckin[]> {
    const { data } = await listGoalCheckins({ path: { goalId } });
    return data.goalCheckins;
  }

  async createCheckin(
    goalId: string,
    goalCheckin: BaseGoalCheckin,
  ): Promise<GoalCheckin> {
    const { data } = await createGoalCheckin({
      path: { goalId },
      body: { goalCheckin },
      ...this.tz,
    });
    return data.goalCheckin;
  }

  async updateCheckin(
    goalId: string,
    checkinId: string,
    goalCheckin: PartialGoalCheckin,
  ): Promise<void> {
    await updateGoalCheckin({
      path: { goalId, checkinId },
      body: { goalCheckin },
      ...this.tz,
      validateStatus: (status) => status === 200 || status === 304,
    });
  }

  async deleteCheckin(goalId: string, checkinId: string): Promise<void> {
    await deleteGoalCheckin({ path: { goalId, checkinId } });
  }

  async suggestCheckin(goalId: string): Promise<GoalCheckinSuggestion> {
    const { data } = await suggestGoalCheckin({ path: { goalId }, ...this.tz });
    return data.suggestion;
  }

  /* Habits --------------------------------------------------------------- */

  async listHabitLogs(
    goalId: string,
    range: { from?: string; to?: string } = {},
  ): Promise<{ logs: GoalHabitLog[]; summary: GoalHabitSummary }> {
    const { data } = await listGoalHabitLogs({
      path: { goalId },
      query: range,
      ...this.tz,
    });
    return { logs: data.goalHabitLogs, summary: data.summary };
  }

  /** Logs a day: `today` or YYYY-MM-DD. With no log, the day is marked done. */
  async logHabit(
    goalId: string,
    date: string,
    goalHabitLog?: BaseGoalHabitLog,
  ): Promise<GoalHabitLog> {
    const { data } = await logGoalHabit({
      path: { goalId, date },
      body: goalHabitLog ? { goalHabitLog } : {},
      ...this.tz,
    });
    return data.goalHabitLog;
  }

  async deleteHabitLog(goalId: string, date: string): Promise<void> {
    await deleteGoalHabitLog({ path: { goalId, date }, ...this.tz });
  }

  async listHabitsForDay(date = "today"): Promise<GoalHabitDay[]> {
    const { data } = await listGoalHabitsForDay({ path: { date }, ...this.tz });
    return data.habits;
  }

  async getExecution(
    span: { week?: string; cycleId?: string } = {},
  ): Promise<GoalExecution> {
    const { data } = await getGoalExecution({ query: span, ...this.tz });
    return data.execution;
  }

  /* Categories and cycles ------------------------------------------------ */

  async listCategories(): Promise<GoalCategory[]> {
    const { data } = await listGoalCategories();
    return data.goalCategories;
  }

  async createCategory(goalCategory: BaseGoalCategory): Promise<GoalCategory> {
    const { data } = await createGoalCategory({ body: { goalCategory } });
    return data.goalCategory;
  }

  async updateCategory(
    categoryId: string,
    goalCategory: PartialGoalCategory,
  ): Promise<void> {
    await updateGoalCategory({
      path: { categoryId },
      body: { goalCategory },
      validateStatus: (status) => status === 200 || status === 304,
    });
  }

  async deleteCategory(categoryId: string, moveTo?: string): Promise<void> {
    await deleteGoalCategory({
      path: { categoryId },
      query: moveTo ? { moveTo } : undefined,
    });
  }

  async reorderCategories(categoryIds: string[]): Promise<GoalCategory[]> {
    const { data } = await reorderGoalCategories({ body: { categoryIds } });
    return data.goalCategories;
  }

  async listCycles(): Promise<GoalCycle[]> {
    const { data } = await listGoalCycles({ ...this.tz });
    return data.goalCycles;
  }
}

const goalsApi = new GoalsApi();

export default goalsApi;
