import { ListReviewsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
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
export class ListReviewsController {
  constructor(private readonly reviews: ReviewService) {}

  @Get("/reviews")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's reviews of one kind in a range",
    description:
      "The caller's daily or weekly reviews whose periods start from one date to another, oldest first, each with its answers. The range is at most 400 days.",
    operationId: "ListReviews",
    tags: ["Reviews"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "kind",
    required: true,
    type: String,
    description: "daily or weekly",
  })
  @ApiQuery({
    name: "from",
    required: true,
    type: String,
    description: "The first period start to include, as YYYY-MM-DD",
  })
  @ApiQuery({
    name: "to",
    required: true,
    type: String,
    description: "The last period start to include, as YYYY-MM-DD",
  })
  @ApiOkResponse({
    type: ListReviewsResponse,
    description: "The caller's reviews in the range.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("kind") kind: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListReviewsResponse = {
      reviews: await this.reviews.list(user.userId, kind, from, to),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
