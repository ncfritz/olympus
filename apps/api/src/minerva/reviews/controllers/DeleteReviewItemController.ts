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
import { ReviewItemService } from "../services/ReviewItemService";

@Controller({ version: "1" })
export class DeleteReviewItemController {
  constructor(private readonly reviewItems: ReviewItemService) {}

  @Delete("/reviews/item/:itemId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's plan items",
    description:
      "Removes an item for good. Removing a carried copy undoes the carry: the item it came from is open again.",
    operationId: "DeleteReviewItem",
    tags: ["Review Items"],
  })
  @ApiParam({
    name: "itemId",
    description: "The ID of the item to delete",
    type: String,
  })
  @ApiNoContentResponse({ description: "The item was deleted." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.reviewItems.delete(user.userId, itemId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
