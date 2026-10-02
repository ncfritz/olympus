import {
  CreateReviewAnswerItemRequest,
  CreateReviewAnswerItemResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { ReviewAnswerService } from "../services/ReviewAnswerService";

@Controller({ version: "1" })
export class CreateReviewAnswerItemController {
  constructor(private readonly answers: ReviewAnswerService) {}

  @Post("/review/:reviewId/answer/:promptId/items")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Adds an item to one of a review's list prompts",
    description:
      "Adds an item at the end of a list prompt's answer in one of the caller's reviews; the prompt must be the caller's and of the review's kind. Items have no route of their own, so no Location.",
    operationId: "CreateReviewAnswerItem",
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
    type: CreateReviewAnswerItemRequest,
    required: true,
    description: "Input for the CreateReviewAnswerItem operation",
  })
  @ApiCreatedResponse({
    type: CreateReviewAnswerItemResponse,
    description: "The item was added.",
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
    @Param("promptId", ParseUUIDPipe) promptId: string,
    @Body() request: CreateReviewAnswerItemRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CreateReviewAnswerItemResponse = {
      answer: await this.answers.addItem(
        user.userId,
        reviewId,
        promptId,
        request?.answer,
      ),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}
