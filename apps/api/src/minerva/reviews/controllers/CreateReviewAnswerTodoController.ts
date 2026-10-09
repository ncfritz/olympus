import { CreateReviewAnswerTodoResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
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
import { ReviewAnswerService } from "../services/ReviewAnswerService";
import { DescribeReviewItemController } from "./DescribeReviewItemController";

@Controller({ version: "1" })
export class CreateReviewAnswerTodoController {
  constructor(private readonly answers: ReviewAnswerService) {}

  @Post("/review/:reviewId/answer/:promptId/item/:answerId/todo")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Makes an item of a list prompt a to-do",
    description:
      "Plans a to-do titled as the item reads for the period after the review's (tomorrow for a daily review, next week for a weekly one), last of its to-dos, and links the item to it. An item becomes one to-do, once.",
    operationId: "CreateReviewAnswerTodo",
    tags: ["Reviews"],
  })
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
  @ApiCreatedResponse({
    type: CreateReviewAnswerTodoResponse,
    description: "The to-do was planned and the item linked to it.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the to-do",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The item is already a to-do.",
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
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CreateReviewAnswerTodoResponse = await this.answers.toTodo(
      user.userId,
      reviewId,
      promptId,
      answerId,
    );
    setLocation(response, httpRequest, DescribeReviewItemController, {
      itemId: body.reviewItem.id,
    });
    response.status(HttpStatus.CREATED).send(body);
  }
}
