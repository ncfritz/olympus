import {
  CreateReviewItemRequest,
  CreateReviewItemResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { ReviewItemService } from "../services/ReviewItemService";
import { DescribeReviewItemController } from "./DescribeReviewItemController";

@Controller({ version: "1" })
export class CreateReviewItemController {
  constructor(private readonly reviewItems: ReviewItemService) {}

  @Post("/review/:reviewId/items")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Plans an item in one of the signed-in user's reviews",
    description:
      "Plans a priority or to-do for the period after the review's: a daily review plans the next day, a weekly review the next week. The item goes at the end of its kind, open.",
    operationId: "CreateReviewItem",
    tags: ["Review Items"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "reviewId",
    description: "The ID of the review planning the item",
    type: String,
  })
  @ApiBody({
    type: CreateReviewItemRequest,
    required: true,
    description: "Input for the CreateReviewItem operation",
  })
  @ApiCreatedResponse({
    type: CreateReviewItemResponse,
    description: "The item was planned.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the item",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Another item took the same place at the same time.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() request: CreateReviewItemRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const reviewItem = await this.reviewItems.create(
      user.userId,
      reviewId,
      request?.reviewItem,
    );
    setLocation(response, httpRequest, DescribeReviewItemController, {
      itemId: reviewItem.id,
    });
    const body: CreateReviewItemResponse = { reviewItem };
    response.status(HttpStatus.CREATED).send(body);
  }
}
