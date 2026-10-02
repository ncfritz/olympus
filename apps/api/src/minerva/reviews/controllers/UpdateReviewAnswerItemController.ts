import {
  UpdateReviewAnswerItemRequest,
  UpdateReviewAnswerItemResponse,
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
export class UpdateReviewAnswerItemController {
  constructor(private readonly answers: ReviewAnswerService) {}

  @Put("/review/:reviewId/answer/:promptId/item/:answerId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Rewrites an item of one of a review's list prompts",
    description:
      "Rewrites one item of a list prompt's answer in one of the caller's reviews. One rewritten after the review was completed is marked as edited later.",
    operationId: "UpdateReviewAnswerItem",
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
  @ApiParam({
    name: "answerId",
    description: "The ID of the item",
    type: String,
  })
  @ApiBody({
    type: UpdateReviewAnswerItemRequest,
    required: true,
    description: "Input for the UpdateReviewAnswerItem operation",
  })
  @ApiOkResponse({
    type: UpdateReviewAnswerItemResponse,
    description: "The item as saved.",
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
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() request: UpdateReviewAnswerItemRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: UpdateReviewAnswerItemResponse = {
      answer: await this.answers.updateItem(
        user.userId,
        reviewId,
        promptId,
        answerId,
        request?.answer,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
