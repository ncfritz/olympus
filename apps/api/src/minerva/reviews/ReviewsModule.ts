import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CarryReviewItemController } from "./controllers/CarryReviewItemController";
import { CreateReviewItemController } from "./controllers/CreateReviewItemController";
import { DeleteReviewItemController } from "./controllers/DeleteReviewItemController";
import { DescribeReviewItemController } from "./controllers/DescribeReviewItemController";
import { ListReviewItemsController } from "./controllers/ListReviewItemsController";
import { ReorderReviewItemsController } from "./controllers/ReorderReviewItemsController";
import { UpdateReviewItemController } from "./controllers/UpdateReviewItemController";
import { CompleteReviewController } from "./controllers/CompleteReviewController";
import { CreateReviewController } from "./controllers/CreateReviewController";
import { CreateReviewPromptController } from "./controllers/CreateReviewPromptController";
import { DeleteReviewController } from "./controllers/DeleteReviewController";
import { DeleteReviewPromptController } from "./controllers/DeleteReviewPromptController";
import { DescribeReviewController } from "./controllers/DescribeReviewController";
import { DescribeReviewPromptController } from "./controllers/DescribeReviewPromptController";
import { ListReviewPromptsController } from "./controllers/ListReviewPromptsController";
import { ListReviewsController } from "./controllers/ListReviewsController";
import { ReorderReviewPromptsController } from "./controllers/ReorderReviewPromptsController";
import { UpdateReviewAnswerController } from "./controllers/UpdateReviewAnswerController";
import { UpdateReviewController } from "./controllers/UpdateReviewController";
import { UpdateReviewPromptController } from "./controllers/UpdateReviewPromptController";
import { ReviewItemService } from "./services/ReviewItemService";
import { ReviewPromptService } from "./services/ReviewPromptService";
import { ReviewService } from "./services/ReviewService";

/**
 * Reviews: the daily and weekly reviews, each user's own (ADR 0027,
 * docs/plans/activity-review/README.md): reviews, prompts and answers,
 * and the items reviews plan.
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [ReviewService, ReviewPromptService, ReviewItemService],
  controllers: [
    ListReviewPromptsController,
    CreateReviewPromptController,
    ReorderReviewPromptsController,
    DescribeReviewPromptController,
    UpdateReviewPromptController,
    DeleteReviewPromptController,
    ListReviewsController,
    CreateReviewController,
    DescribeReviewController,
    UpdateReviewController,
    CompleteReviewController,
    DeleteReviewController,
    UpdateReviewAnswerController,
    ListReviewItemsController,
    ReorderReviewItemsController,
    CreateReviewItemController,
    DescribeReviewItemController,
    UpdateReviewItemController,
    CarryReviewItemController,
    DeleteReviewItemController,
  ],
})
export class ReviewsModule {}
