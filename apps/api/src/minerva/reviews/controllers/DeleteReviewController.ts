import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
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
export class DeleteReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Delete("/review/:reviewId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's reviews",
    description:
      "Removes a review and its answers for good. What happened in its period is untouched.",
    operationId: "DeleteReview",
    tags: ["Reviews"],
  })
  @ApiParam({
    name: "reviewId",
    description: "The ID of the review to delete",
    type: String,
  })
  @ApiNoContentResponse({ description: "The review was deleted." })
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
    await this.reviews.delete(user.userId, reviewId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
