import {
  ReorderReviewAnswerItemsRequest,
  ReorderReviewAnswerItemsResponse,
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
import { ReviewAnswerService } from "../services/ReviewAnswerService";

@Controller({ version: "1" })
export class ReorderReviewAnswerItemsController {
  constructor(private readonly answers: ReviewAnswerService) {}

  @Put("/review/:reviewId/answer/:promptId/items/order")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reorders the items of one of a review's list prompts",
    description:
      "Puts a list prompt's items in one of the caller's reviews in the order given, which must name every one of them exactly once.",
    operationId: "ReorderReviewAnswerItems",
    tags: ["Reviews"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "reviewId",
    description: "The ID of the review",
    type: String,
  })
  @ApiParam({
    name: "promptId",
    description: "The ID of the list prompt",
    type: String,
  })
  @ApiBody({
    type: ReorderReviewAnswerItemsRequest,
    required: true,
    description: "Input for the ReorderReviewAnswerItems operation",
  })
  @ApiOkResponse({
    type: ReorderReviewAnswerItemsResponse,
    description: "The prompt's items in the review, in their new order.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Param("promptId", ParseUUIDPipe) promptId: string,
    @Body() request: ReorderReviewAnswerItemsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ReorderReviewAnswerItemsResponse = {
      answers: await this.answers.reorderItems(
        user.userId,
        reviewId,
        promptId,
        request?.answerIds,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
