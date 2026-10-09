import {
  CreateGoalCategoryRequest,
  CreateGoalCategoryResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { GoalCategoryService } from "../services/GoalCategoryService";
import { DescribeGoalCategoryController } from "./DescribeGoalCategoryController";

@Controller({ version: "1" })
export class CreateGoalCategoryController {
  constructor(private readonly goalCategories: GoalCategoryService) {}

  @Post("/goals/categories")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Creates a goal category for the signed-in user",
    description:
      "Adds a category at the end of the caller's list. A name the caller already has, in any case, is refused.",
    operationId: "CreateGoalCategory",
    tags: ["Goal Categories"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateGoalCategoryRequest,
    required: true,
    description: "Input for the CreateGoalCategory operation",
  })
  @ApiCreatedResponse({
    type: CreateGoalCategoryResponse,
    description: "The category was created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created category",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The caller already has a category with that name.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateGoalCategoryRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goalCategory = await this.goalCategories.create(
      user.userId,
      request?.goalCategory,
    );
    setLocation(response, httpRequest, DescribeGoalCategoryController, {
      categoryId: goalCategory.id,
    });
    const body: CreateGoalCategoryResponse = { goalCategory };
    response.status(HttpStatus.CREATED).send(body);
  }
}
