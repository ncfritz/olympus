import {
  ReorderReviewItemsRequest,
  ReorderReviewItemsResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
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
export class ReorderReviewItemsController {
  constructor(private readonly reviewItems: ReviewItemService) {}

  @Put("/reviews/items/order")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reorders the signed-in user's plan items of one period and kind",
    description:
      "Puts a day's or week's priorities, or its to-dos, in the order given, which must name every one of them, whatever their status, exactly once.",
    operationId: "ReorderReviewItems",
    tags: ["Review Items"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ReorderReviewItemsRequest,
    required: true,
    description: "Input for the ReorderReviewItems operation",
  })
  @ApiOkResponse({
    type: ReorderReviewItemsResponse,
    description: "The period's items of that kind, in their new order.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: ReorderReviewItemsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ReorderReviewItemsResponse = {
      reviewItems: await this.reviewItems.reorder(
        user.userId,
        request?.scope,
        request?.periodStart,
        request?.kind,
        request?.itemIds,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
