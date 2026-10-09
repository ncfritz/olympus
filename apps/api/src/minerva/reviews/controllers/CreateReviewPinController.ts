import {
  CreateReviewPinRequest,
  CreateReviewPinResponse,
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
import { ReviewPinService } from "../services/ReviewPinService";

@Controller({ version: "1" })
export class CreateReviewPinController {
  constructor(private readonly reviewPins: ReviewPinService) {}

  @Post("/review/:reviewId/pins")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Pins an answer from the week, or a note, to a weekly review",
    description:
      "Keeps an answer from one of the week's daily reviews, or a note, with one of the caller's weekly reviews. Each is pinned once; a daily review keeps no pins. Pins have no route of their own, so no Location is set.",
    operationId: "CreateReviewPin",
    tags: ["Reviews"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "reviewId",
    description: "The ID of the weekly review",
    type: String,
  })
  @ApiBody({
    type: CreateReviewPinRequest,
    required: true,
    description: "Input for the CreateReviewPin operation",
  })
  @ApiCreatedResponse({
    type: CreateReviewPinResponse,
    description: "The pin was made.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The answer or note is already pinned to this week.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Body() request: CreateReviewPinRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CreateReviewPinResponse = {
      reviewPin: await this.reviewPins.create(
        user.userId,
        reviewId,
        request?.reviewPin,
      ),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}
