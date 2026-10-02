import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateGoalCategoryController } from "./controllers/CreateGoalCategoryController";
import { CreateGoalCycleController } from "./controllers/CreateGoalCycleController";
import { DeleteGoalCategoryController } from "./controllers/DeleteGoalCategoryController";
import { DeleteGoalCycleController } from "./controllers/DeleteGoalCycleController";
import { DescribeGoalCategoryController } from "./controllers/DescribeGoalCategoryController";
import { DescribeGoalCycleController } from "./controllers/DescribeGoalCycleController";
import { ListGoalCategoriesController } from "./controllers/ListGoalCategoriesController";
import { ListGoalCyclesController } from "./controllers/ListGoalCyclesController";
import { ReorderGoalCategoriesController } from "./controllers/ReorderGoalCategoriesController";
import { UpdateGoalCategoryController } from "./controllers/UpdateGoalCategoryController";
import { UpdateGoalCycleController } from "./controllers/UpdateGoalCycleController";
import { CreateGoalController } from "./controllers/CreateGoalController";
import { CreateGoalMilestoneController } from "./controllers/CreateGoalMilestoneController";
import { DeleteGoalController } from "./controllers/DeleteGoalController";
import { DeleteGoalMilestoneController } from "./controllers/DeleteGoalMilestoneController";
import { DescribeGoalController } from "./controllers/DescribeGoalController";
import { ListGoalsController } from "./controllers/ListGoalsController";
import { ReorderGoalMilestonesController } from "./controllers/ReorderGoalMilestonesController";
import { ReorderGoalsController } from "./controllers/ReorderGoalsController";
import { RestoreGoalController } from "./controllers/RestoreGoalController";
import { UpdateGoalController } from "./controllers/UpdateGoalController";
import { UpdateGoalMilestoneController } from "./controllers/UpdateGoalMilestoneController";
import { CloseGoalController } from "./controllers/CloseGoalController";
import { CreateGoalCheckinController } from "./controllers/CreateGoalCheckinController";
import { DeleteGoalCheckinController } from "./controllers/DeleteGoalCheckinController";
import { DeleteGoalHabitLogController } from "./controllers/DeleteGoalHabitLogController";
import { GetGoalExecutionController } from "./controllers/GetGoalExecutionController";
import { ListGoalCheckinsController } from "./controllers/ListGoalCheckinsController";
import { ListGoalHabitLogsController } from "./controllers/ListGoalHabitLogsController";
import { ListGoalHabitsForDayController } from "./controllers/ListGoalHabitsForDayController";
import { LogGoalHabitController } from "./controllers/LogGoalHabitController";
import { SuggestGoalCheckinController } from "./controllers/SuggestGoalCheckinController";
import { UpdateGoalCheckinController } from "./controllers/UpdateGoalCheckinController";
import { GoalCategoryService } from "./services/GoalCategoryService";
import { GoalCheckinService } from "./services/GoalCheckinService";
import { GoalCycleService } from "./services/GoalCycleService";
import { GoalHabitService } from "./services/GoalHabitService";
import { GoalMilestoneService } from "./services/GoalMilestoneService";
import { GoalService } from "./services/GoalService";

/**
 * Goals: categories, cycles, goals, check-ins and habits, each user's own
 * (ADR 0026, docs/plans/goals/README.md).
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [
    GoalCategoryService,
    GoalCycleService,
    GoalService,
    GoalMilestoneService,
    GoalCheckinService,
    GoalHabitService,
  ],
  controllers: [
    ListGoalCategoriesController,
    CreateGoalCategoryController,
    ReorderGoalCategoriesController,
    DescribeGoalCategoryController,
    UpdateGoalCategoryController,
    DeleteGoalCategoryController,
    ListGoalCyclesController,
    CreateGoalCycleController,
    DescribeGoalCycleController,
    UpdateGoalCycleController,
    DeleteGoalCycleController,
    ListGoalsController,
    CreateGoalController,
    GetGoalExecutionController,
    ListGoalHabitsForDayController,
    ReorderGoalsController,
    DescribeGoalController,
    UpdateGoalController,
    DeleteGoalController,
    RestoreGoalController,
    CreateGoalMilestoneController,
    ReorderGoalMilestonesController,
    UpdateGoalMilestoneController,
    DeleteGoalMilestoneController,
    CloseGoalController,
    ListGoalCheckinsController,
    CreateGoalCheckinController,
    SuggestGoalCheckinController,
    UpdateGoalCheckinController,
    DeleteGoalCheckinController,
    ListGoalHabitLogsController,
    LogGoalHabitController,
    DeleteGoalHabitLogController,
  ],
})
export class GoalsModule {}
