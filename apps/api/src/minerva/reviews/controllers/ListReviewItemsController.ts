import { ListReviewItemsResponse } from "@ncfritz/olympus-model";
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
import { ReviewItemService } from "../services/ReviewItemService";

@Controller({ version: "1" })
export class ListReviewItemsController {
  constructor(private readonly reviewItems: ReviewItemService) {}

  @Get("/reviews/items")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's plan items for a range of periods",
    description:
      "The caller's day or week items whose periods start from one date to another, whatever their status: by period, priorities before to-dos, each in its order, each with its carry count. The range is at most 400 days.",
    operationId: "ListReviewItems",
    tags: ["Review Items"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "scope",
    required: true,
    type: String,
    description: "day or week",
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
    type: ListReviewItemsResponse,
    description: "The caller's items in the range.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("scope") scope: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListReviewItemsResponse = {
      reviewItems: await this.reviewItems.list(user.userId, scope, from, to),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
