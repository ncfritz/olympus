import { DescribeGoalCategoryResponse } from "@ncfritz/olympus-model";
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
import { GoalCategoryService } from "../services/GoalCategoryService";

@Controller({ version: "1" })
export class DescribeGoalCategoryController {
  constructor(private readonly goalCategories: GoalCategoryService) {}

  @Get("/goals/category/:categoryId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's goal categories",
    description:
      "Returns a single category of the caller's, with its vision. Another user's category is not found.",
    operationId: "DescribeGoalCategory",
    tags: ["Goal Categories"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "categoryId",
    description: "The ID of the category",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeGoalCategoryResponse,
    description: "The category was found.",
  })
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
    const body: DescribeGoalCategoryResponse = {
      goalCategory: await this.goalCategories.describe(user.userId, categoryId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
