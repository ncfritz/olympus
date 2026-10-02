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
import { ReviewPinService } from "../services/ReviewPinService";

@Controller({ version: "1" })
export class DeleteReviewPinController {
  constructor(private readonly reviewPins: ReviewPinService) {}

  @Delete("/review/:reviewId/pin/:pinId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Unpins one of a weekly review's pins",
    description: "Removes a pin; the answer or note itself is untouched.",
    operationId: "DeleteReviewPin",
    tags: ["Reviews"],
  })
  @ApiParam({
    name: "reviewId",
    description: "The ID of the weekly review",
    type: String,
  })
  @ApiParam({
    name: "pinId",
    description: "The ID of the pin to remove",
    type: String,
  })
  @ApiNoContentResponse({ description: "The pin was removed." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
    @Param("pinId", ParseUUIDPipe) pinId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.reviewPins.delete(user.userId, reviewId, pinId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
