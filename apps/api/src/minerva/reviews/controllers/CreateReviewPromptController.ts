import {
  CreateReviewPromptRequest,
  CreateReviewPromptResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
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
import { ReviewPromptService } from "../services/ReviewPromptService";
import { DescribeReviewPromptController } from "./DescribeReviewPromptController";

@Controller({ version: "1" })
export class CreateReviewPromptController {
  constructor(private readonly reviewPrompts: ReviewPromptService) {}

  @Post("/reviews/prompts")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Creates a review prompt for the signed-in user",
    description:
      "Adds a prompt at the end of its kind and section; reviews of that kind ask it from then on.",
    operationId: "CreateReviewPrompt",
    tags: ["Review Prompts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateReviewPromptRequest,
    required: true,
    description: "Input for the CreateReviewPrompt operation",
  })
  @ApiCreatedResponse({
    type: CreateReviewPromptResponse,
    description: "The prompt was created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created prompt",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Another prompt was added to the section at the same time.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateReviewPromptRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const reviewPrompt = await this.reviewPrompts.create(
      user.userId,
      request?.reviewPrompt,
    );
    setLocation(response, httpRequest, DescribeReviewPromptController, {
      promptId: reviewPrompt.id,
    });
    const body: CreateReviewPromptResponse = { reviewPrompt };
    response.status(HttpStatus.CREATED).send(body);
  }
}
