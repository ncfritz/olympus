import { DescribeReviewPromptResponse } from "@ncfritz/olympus-model";
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
import { ReviewPromptService } from "../services/ReviewPromptService";

@Controller({ version: "1" })
export class DescribeReviewPromptController {
  constructor(private readonly reviewPrompts: ReviewPromptService) {}

  @Get("/reviews/prompt/:promptId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's review prompts",
    description:
      "Returns a single prompt of the caller's. Another user's prompt is not found.",
    operationId: "DescribeReviewPrompt",
    tags: ["Review Prompts"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "promptId",
    description: "The ID of the prompt",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeReviewPromptResponse,
    description: "The prompt was found.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("promptId", ParseUUIDPipe) promptId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeReviewPromptResponse = {
      reviewPrompt: await this.reviewPrompts.describe(user.userId, promptId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
