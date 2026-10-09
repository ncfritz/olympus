import { DescribeGoalResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
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
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";
import { GoalService } from "../services/GoalService";

@Controller({ version: "1" })
export class DescribeGoalController {
  constructor(private readonly goals: GoalService) {}

  @Get("/goal/:goalId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's goals",
    description:
      "Returns a goal of the caller's, deleted or not, with its habit rule, milestones, live sub-goals and tags, its progress worked out for today in the caller's timezone. Another user's goal is not found.",
    operationId: "DescribeGoal",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal",
    type: String,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: DescribeGoalResponse,
    description: "The goal was found.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @HeaderTimezone() tz: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeGoalResponse = {
      goal: await this.goals.describe(user.userId, goalId, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
