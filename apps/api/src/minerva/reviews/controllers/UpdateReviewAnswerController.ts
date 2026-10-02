import {
  UpdateReviewAnswerRequest,
  UpdateReviewAnswerResponse,
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
  ApiNoContentResponse,
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
import { ReviewService } from "../services/ReviewService";

@Controller({ version: "1" })
export class UpdateReviewAnswerController {
  constructor(private readonly reviews: ReviewService) {}

  @Put("/review/:reviewId/answer/:promptId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Saves the answer to one of a review's prompts",
    description:
      "Writes or rewrites the answer to a prompt of the caller's, of the review's kind. An answer saved again keeps its created time; one saved after the review was completed is marked as edited later. A body that is empty or only whitespace removes the answer.",
    operationId: "UpdateReviewAnswer",
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
    description: "The ID of the prompt answered",
    type: String,
  })
  @ApiBody({
    type: UpdateReviewAnswerRequest,
    required: true,
    description: "Input for the UpdateReviewAnswer operation",
  })
  @ApiOkResponse({
    type: UpdateReviewAnswerResponse,
    description: "The answer as saved.",
  })
  @ApiNoContentResponse({
    description: "The body was empty, so there is no answer now.",
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
    @Body() request: UpdateReviewAnswerRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const answer = await this.reviews.answer(
      user.userId,
      reviewId,
      promptId,
      request?.answer,
    );
    if (!answer) {
      response.status(HttpStatus.NO_CONTENT).send();
      return;
    }
    const body: UpdateReviewAnswerResponse = { answer };
    response.status(HttpStatus.OK).send(body);
  }
}
