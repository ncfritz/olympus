import {
  EmptyResponse,
  UpdateReviewRequest,
  UpdateReviewResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { ReviewService } from "../services/ReviewService";

@Controller({ version: "1" })
export class UpdateReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Put("/review/:reviewId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's reviews",
    description:
      "Sets the step reached and the ratings: overall on both kinds, mood, energy and focus on a day, progress and balance on a week, each 1 to 5 or null. Ratings are refused once the review is completed; the step still moves.",
    operationId: "UpdateReview",
    tags: ["Reviews"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "reviewId",
    description: "The ID of the review to change",
    type: String,
  })
  @ApiBody({
    type: UpdateReviewRequest,
    required: true,
    description: "Input for the UpdateReview operation",
  })
  @ApiOkResponse({
    type: UpdateReviewResponse,
    description: "The review with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The review is completed and a rating would change.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() request: UpdateReviewRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const review = await this.reviews.update(
      user.userId,
      reviewId,
      request?.review,
    );
    if (!review) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateReviewResponse = { review };
    response.status(HttpStatus.OK).send(body);
  }
}
