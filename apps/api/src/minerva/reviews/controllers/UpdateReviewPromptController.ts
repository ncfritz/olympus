import {
  EmptyResponse,
  UpdateReviewPromptRequest,
  UpdateReviewPromptResponse,
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
import { ReviewPromptService } from "../services/ReviewPromptService";

@Controller({ version: "1" })
export class UpdateReviewPromptController {
  constructor(private readonly reviewPrompts: ReviewPromptService) {}

  @Put("/reviews/prompt/:promptId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's review prompts",
    description:
      "Rewords a prompt, changes or removes its placeholder, or archives it or brings it back. An archived prompt is no longer asked; reviews that answered it keep it.",
    operationId: "UpdateReviewPrompt",
    tags: ["Review Prompts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "promptId",
    description: "The ID of the prompt to change",
    type: String,
  })
  @ApiBody({
    type: UpdateReviewPromptRequest,
    required: true,
    description: "Input for the UpdateReviewPrompt operation",
  })
  @ApiOkResponse({
    type: UpdateReviewPromptResponse,
    description: "The prompt with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("promptId", ParseUUIDPipe) promptId: string,
    @Body() request: UpdateReviewPromptRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const reviewPrompt = await this.reviewPrompts.update(
      user.userId,
      promptId,
      request?.reviewPrompt,
    );
    if (!reviewPrompt) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateReviewPromptResponse = { reviewPrompt };
    response.status(HttpStatus.OK).send(body);
  }
}
