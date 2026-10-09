import { ListReviewPinsResponse } from "@ncfritz/olympus-model";
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
import { ReviewPinService } from "../services/ReviewPinService";

@Controller({ version: "1" })
export class ListReviewPinsController {
  constructor(private readonly reviewPins: ReviewPinService) {}

  @Get("/review/:reviewId/pins")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists a weekly review's pins",
    description:
      "The answers and notes one of the caller's reviews keeps, oldest first. A note deleted since keeps its pin until it is purged.",
    operationId: "ListReviewPins",
    tags: ["Reviews"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "reviewId",
    description: "The ID of the weekly review",
    type: String,
  })
  @ApiOkResponse({
    type: ListReviewPinsResponse,
    description: "The review's pins.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListReviewPinsResponse = {
      reviewPins: await this.reviewPins.list(user.userId, reviewId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
