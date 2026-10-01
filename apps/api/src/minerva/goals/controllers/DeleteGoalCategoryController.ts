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
import { GoalCategoryService } from "../services/GoalCategoryService";

@Controller({ version: "1" })
export class DeleteGoalCategoryController {
  constructor(private readonly goalCategories: GoalCategoryService) {}

  @Delete("/goals/category/:categoryId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's goal categories",
    description:
      "Removes a category from the caller's list. To keep a category's goals out of sight without deleting it, archive it instead.",
    operationId: "DeleteGoalCategory",
    tags: ["Goal Categories"],
  })
  @ApiParam({
    name: "categoryId",
    description: "The ID of the category to delete",
    type: String,
  })
  @ApiNoContentResponse({ description: "The category was deleted." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.goalCategories.delete(user.userId, categoryId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
