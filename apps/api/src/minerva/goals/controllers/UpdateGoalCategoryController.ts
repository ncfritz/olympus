import {
  EmptyResponse,
  UpdateGoalCategoryRequest,
  UpdateGoalCategoryResponse,
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
import { GoalCategoryService } from "../services/GoalCategoryService";

@Controller({ version: "1" })
export class UpdateGoalCategoryController {
  constructor(private readonly goalCategories: GoalCategoryService) {}

  @Put("/goals/category/:categoryId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's goal categories",
    description:
      "Renames a category, changes its colour, icon or vision, or archives it or brings it back. An archived category leaves the pickers and keeps its goals.",
    operationId: "UpdateGoalCategory",
    tags: ["Goal Categories"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "categoryId",
    description: "The ID of the category to change",
    type: String,
  })
  @ApiBody({
    type: UpdateGoalCategoryRequest,
    required: true,
    description: "Input for the UpdateGoalCategory operation",
  })
  @ApiOkResponse({
    type: UpdateGoalCategoryResponse,
    description: "The category with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The caller already has a category with the new name.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Body() request: UpdateGoalCategoryRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goalCategory = await this.goalCategories.update(
      user.userId,
      categoryId,
      request?.goalCategory,
    );
    if (!goalCategory) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateGoalCategoryResponse = { goalCategory };
    response.status(HttpStatus.OK).send(body);
  }
}
