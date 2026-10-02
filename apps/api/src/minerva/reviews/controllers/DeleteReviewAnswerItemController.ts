import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
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
export class DeleteReviewAnswerItemController {
  constructor(private readonly answers: ReviewAnswerService) {}

  @Delete("/review/:reviewId/answer/:promptId/item/:answerId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Removes an item of one of a review's list prompts",
    description:
      "Removes one item of a list prompt's answer in one of the caller's reviews. A to-do it became stays.",
    operationId: "DeleteReviewAnswerItem",
    tags: ["Reviews"],
  })
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
  @ApiNoContentResponse({ description: "The item was removed." })
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
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.answers.deleteItem(user.userId, reviewId, promptId, answerId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
