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
import { GoalCategoryService } from "./services/GoalCategoryService";
import { GoalCycleService } from "./services/GoalCycleService";

/**
 * Goals: categories, cycles, goals, check-ins and habits, each user's own
 * (ADR 0026, docs/plans/goals/README.md). The operations arrive phase by
 * phase.
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [GoalCategoryService, GoalCycleService],
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
  ],
})
export class GoalsModule {}
