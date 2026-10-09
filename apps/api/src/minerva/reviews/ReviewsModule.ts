import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateReviewPinController } from "./controllers/CreateReviewPinController";
import { DeleteReviewPinController } from "./controllers/DeleteReviewPinController";
import { GetReviewSummaryController } from "./controllers/GetReviewSummaryController";
import { ListReviewPinsController } from "./controllers/ListReviewPinsController";
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
import { CreateReviewAnswerItemController } from "./controllers/CreateReviewAnswerItemController";
import { CreateReviewAnswerTodoController } from "./controllers/CreateReviewAnswerTodoController";
import { DeleteReviewAnswerItemController } from "./controllers/DeleteReviewAnswerItemController";
import { ReorderReviewAnswerItemsController } from "./controllers/ReorderReviewAnswerItemsController";
import { UpdateReviewAnswerController } from "./controllers/UpdateReviewAnswerController";
import { UpdateReviewAnswerItemController } from "./controllers/UpdateReviewAnswerItemController";
import { UpdateReviewController } from "./controllers/UpdateReviewController";
import { UpdateReviewPromptController } from "./controllers/UpdateReviewPromptController";
import { ReviewAnswerService } from "./services/ReviewAnswerService";
import { ReviewItemService } from "./services/ReviewItemService";
import { ReviewPinService } from "./services/ReviewPinService";
import { ReviewPromptService } from "./services/ReviewPromptService";
import { ReviewService } from "./services/ReviewService";
import { ReviewSummaryService } from "./services/ReviewSummaryService";

/**
 * Reviews: the daily and weekly reviews, each user's own (ADR 0027,
 * docs/plans/activity-review/README.md): reviews, prompts and answers,
 * the items reviews plan, weekly pins and the summary.
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [
    ReviewService,
    ReviewAnswerService,
    ReviewPromptService,
    ReviewItemService,
    ReviewPinService,
    ReviewSummaryService,
  ],
  controllers: [
    ListReviewPromptsController,
    CreateReviewPromptController,
    ReorderReviewPromptsController,
    DescribeReviewPromptController,
    UpdateReviewPromptController,
    DeleteReviewPromptController,
    GetReviewSummaryController,
    ListReviewsController,
    CreateReviewController,
    DescribeReviewController,
    UpdateReviewController,
    CompleteReviewController,
    DeleteReviewController,
    UpdateReviewAnswerController,
    CreateReviewAnswerItemController,
    ReorderReviewAnswerItemsController,
    UpdateReviewAnswerItemController,
    DeleteReviewAnswerItemController,
    CreateReviewAnswerTodoController,
    ListReviewPinsController,
    CreateReviewPinController,
    DeleteReviewPinController,
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
