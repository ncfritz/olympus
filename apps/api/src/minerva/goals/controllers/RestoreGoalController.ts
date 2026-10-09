import { RestoreGoalResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
export class RestoreGoalController {
  constructor(private readonly goals: GoalService) {}

  @Post("/goal/:goalId/restore")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Restores one of the signed-in user's deleted goals",
    description:
      "Brings back a deleted goal. A goal whose parent is deleted cannot be restored until the parent is.",
    operationId: "RestoreGoal",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal to restore",
    type: String,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: RestoreGoalResponse,
    description: "The goal was restored.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The goal is not deleted, or its parent is.",
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
    const body: RestoreGoalResponse = {
      goal: await this.goals.restore(user.userId, goalId, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
