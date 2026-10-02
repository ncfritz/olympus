import {
  ReorderReviewPromptsRequest,
  ReorderReviewPromptsResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
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
export class ReorderReviewPromptsController {
  constructor(private readonly reviewPrompts: ReviewPromptService) {}

  @Put("/reviews/prompts/order")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reorders the signed-in user's review prompts in one section",
    description:
      "Puts the caller's prompts of one kind and section in the order given, which must name every one of them, archived ones included, exactly once.",
    operationId: "ReorderReviewPrompts",
    tags: ["Review Prompts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ReorderReviewPromptsRequest,
    required: true,
    description: "Input for the ReorderReviewPrompts operation",
  })
  @ApiOkResponse({
    type: ReorderReviewPromptsResponse,
    description: "All of the caller's prompts, in their new order.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: ReorderReviewPromptsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ReorderReviewPromptsResponse = {
      reviewPrompts: await this.reviewPrompts.reorder(
        user.userId,
        request?.kind,
        request?.section,
        request?.promptIds,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
