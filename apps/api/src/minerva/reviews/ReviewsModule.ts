import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
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
import { ReviewPromptService } from "./services/ReviewPromptService";
import { ReviewService } from "./services/ReviewService";

/**
 * Reviews: the daily and weekly reviews, each user's own (ADR 0027,
 * docs/plans/activity-review/README.md). Phase 1: reviews, prompts and
 * answers.
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [ReviewService, ReviewPromptService],
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
  ],
})
export class ReviewsModule {}
