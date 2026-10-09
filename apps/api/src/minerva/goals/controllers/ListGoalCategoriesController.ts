import { ListGoalCategoriesResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
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
import { GoalCategoryService } from "../services/GoalCategoryService";

@Controller({ version: "1" })
export class ListGoalCategoriesController {
  constructor(private readonly goalCategories: GoalCategoryService) {}

  @Get("/goals/categories")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's goal categories",
    description:
      "Every category the caller has, archived ones included, in their order. The first time a user's categories are read they are given the six starter categories, once.",
    operationId: "ListGoalCategories",
    tags: ["Goal Categories"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListGoalCategoriesResponse,
    description: "The caller's categories.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListGoalCategoriesResponse = {
      goalCategories: await this.goalCategories.list(user.userId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
