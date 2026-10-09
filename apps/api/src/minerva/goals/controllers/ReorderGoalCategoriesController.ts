import {
  ReorderGoalCategoriesRequest,
  ReorderGoalCategoriesResponse,
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
import { GoalCategoryService } from "../services/GoalCategoryService";

@Controller({ version: "1" })
export class ReorderGoalCategoriesController {
  constructor(private readonly goalCategories: GoalCategoryService) {}

  @Put("/goals/categories/order")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reorders the signed-in user's goal categories",
    description:
      "Puts the caller's categories in the order given, which must name every one of them, archived ones included, exactly once.",
    operationId: "ReorderGoalCategories",
    tags: ["Goal Categories"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ReorderGoalCategoriesRequest,
    required: true,
    description: "Input for the ReorderGoalCategories operation",
  })
  @ApiOkResponse({
    type: ReorderGoalCategoriesResponse,
    description: "The caller's categories in their new order.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: ReorderGoalCategoriesRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ReorderGoalCategoriesResponse = {
      goalCategories: await this.goalCategories.reorder(
        user.userId,
        request?.categoryIds,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
