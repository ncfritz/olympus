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
import { ReviewPromptService } from "../services/ReviewPromptService";

@Controller({ version: "1" })
export class DeleteReviewPromptController {
  constructor(private readonly reviewPrompts: ReviewPromptService) {}

  @Delete("/reviews/prompt/:promptId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's review prompts",
    description:
      "Removes a prompt that has never been answered. A prompt with answers is refused; archive it instead, so the reviews that answered it keep it.",
    operationId: "DeleteReviewPrompt",
    tags: ["Review Prompts"],
  })
  @ApiParam({
    name: "promptId",
    description: "The ID of the prompt to delete",
    type: String,
  })
  @ApiNoContentResponse({ description: "The prompt was deleted." })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The prompt has answers.",
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
    await this.reviewPrompts.delete(user.userId, promptId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
