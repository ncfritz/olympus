import { ListReviewPromptsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
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
export class ListReviewPromptsController {
  constructor(private readonly reviewPrompts: ReviewPromptService) {}

  @Get("/reviews/prompts")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's review prompts",
    description:
      "Every prompt the caller has, archived ones included: daily before weekly, Reflect before Plan, each in its order. The first time a user's prompts are read they are given the starter prompts, once.",
    operationId: "ListReviewPrompts",
    tags: ["Review Prompts"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "kind",
    required: false,
    type: String,
    description: "daily or weekly, for only that kind's prompts",
  })
  @ApiOkResponse({
    type: ListReviewPromptsResponse,
    description: "The caller's prompts.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("kind") kind: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListReviewPromptsResponse = {
      reviewPrompts: await this.reviewPrompts.list(user.userId, kind),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
