import { CompleteReviewResponse, EmptyResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
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
export class CompleteReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Post("/review/:reviewId/complete")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Completes one of the signed-in user's reviews",
    description:
      "Records when the review was completed, which locks its ratings; its answers stay editable and are marked as edited later. Completing it again changes nothing.",
    operationId: "CompleteReview",
    tags: ["Reviews"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "reviewId",
    description: "The ID of the review to complete",
    type: String,
  })
  @ApiOkResponse({
    type: CompleteReviewResponse,
    description: "The review, completed.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The review was already completed.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const review = await this.reviews.complete(user.userId, reviewId);
    if (!review) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: CompleteReviewResponse = { review };
    response.status(HttpStatus.OK).send(body);
  }
}
