import { DescribeReviewItemResponse } from "@ncfritz/olympus-model";
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
import { ReviewItemService } from "../services/ReviewItemService";

@Controller({ version: "1" })
export class DescribeReviewItemController {
  constructor(private readonly reviewItems: ReviewItemService) {}

  @Get("/reviews/item/:itemId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's plan items",
    description:
      "Returns a single item of the caller's. Another user's item is not found.",
    operationId: "DescribeReviewItem",
    tags: ["Review Items"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "itemId",
    description: "The ID of the item",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeReviewItemResponse,
    description: "The item was found.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeReviewItemResponse = {
      reviewItem: await this.reviewItems.describe(user.userId, itemId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
