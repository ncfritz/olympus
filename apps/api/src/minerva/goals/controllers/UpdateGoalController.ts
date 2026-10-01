import {
  EmptyResponse,
  UpdateGoalRequest,
  UpdateGoalResponse,
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
export class UpdateGoalController {
  constructor(private readonly goals: GoalService) {}

  @Put("/goal/:goalId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's goals",
    description:
      "Changes a goal, replaces its habit rule or its set of tags, in one step. The goal with the changes laid over it must be a valid goal; its type cannot change. Reopening a closed goal clears its closing date.",
    operationId: "UpdateGoal",
    tags: ["Goals"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal to change",
    type: String,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiBody({
    type: UpdateGoalRequest,
    required: true,
    description: "Input for the UpdateGoal operation",
  })
  @ApiOkResponse({
    type: UpdateGoalResponse,
    description: "The goal with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
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
    @Body() request: UpdateGoalRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goal = await this.goals.update(user.userId, goalId, request, tz);
    if (!goal) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateGoalResponse = { goal };
    response.status(HttpStatus.OK).send(body);
  }
}
