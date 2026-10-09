import { DescribeReviewResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
export class DescribeReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get("/review/:reviewId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's reviews",
    description:
      "Returns a single review of the caller's with its ratings and answers. Another user's review is not found.",
    operationId: "DescribeReview",
    tags: ["Reviews"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "reviewId",
    description: "The ID of the review",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeReviewResponse,
    description: "The review was found.",
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
    const body: DescribeReviewResponse = {
      review: await this.reviews.describe(user.userId, reviewId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
