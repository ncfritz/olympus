import { CloseGoalRequest, CloseGoalResponse } from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
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
export class CloseGoalController {
  constructor(private readonly goals: GoalService) {}

  @Post("/goal/:goalId/close")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Closes one of the signed-in user's goals",
    description:
      "Closes an open goal as achieved, missed or dropped, on a day (today by default, never a future one), with an outcome's final value, a hand-set goal's final progress, and what was learned. The one way into a closed status; UpdateGoal reopens.",
    operationId: "CloseGoal",
    tags: ["Goals"],
  })
  @ApiConsumes("application/json")
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
  @ApiBody({
    type: CloseGoalRequest,
    required: true,
    description: "Input for the CloseGoal operation",
  })
  @ApiOkResponse({
    type: CloseGoalResponse,
    description: "The goal, closed.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The goal is already closed.",
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
    @Body() request: CloseGoalRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CloseGoalResponse = {
      goal: await this.goals.close(user.userId, goalId, request?.goalClose, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
