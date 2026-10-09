import {
  EmptyResponse,
  UpdateReviewItemRequest,
  UpdateReviewItemResponse,
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
import { ReviewItemService } from "../services/ReviewItemService";

@Controller({ version: "1" })
export class UpdateReviewItemController {
  constructor(private readonly reviewItems: ReviewItemService) {}

  @Put("/reviews/item/:itemId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's plan items",
    description:
      "Retitles an item, sets it open, done, someday or dropped (done records when), or plans it on a day of its period, with an optional block of time. A carried item's status no longer changes; its copy carries on.",
    operationId: "UpdateReviewItem",
    tags: ["Review Items"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "itemId",
    description: "The ID of the item to change",
    type: String,
  })
  @ApiBody({
    type: UpdateReviewItemRequest,
    required: true,
    description: "Input for the UpdateReviewItem operation",
  })
  @ApiOkResponse({
    type: UpdateReviewItemResponse,
    description: "The item with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The item was carried, so its status no longer changes.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() request: UpdateReviewItemRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const reviewItem = await this.reviewItems.update(
      user.userId,
      itemId,
      request?.reviewItem,
    );
    if (!reviewItem) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateReviewItemResponse = { reviewItem };
    response.status(HttpStatus.OK).send(body);
  }
}
