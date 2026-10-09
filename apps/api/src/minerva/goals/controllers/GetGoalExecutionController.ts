import { GetGoalExecutionResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
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
export class GetGoalExecutionController {
  constructor(private readonly goals: GoalService) {}

  @Get("/goals/execution")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets the signed-in user's execution score",
    description:
      "Habit occurrences done over due for an ISO week or a cycle's execution weeks, overall, per goal and per day; this week in the caller's timezone when neither is given. Days after today are not due yet.",
    operationId: "GetGoalExecution",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "week",
    required: false,
    type: String,
    description: "An ISO week written YYYY-Www, e.g. 2026-W40",
  })
  @ApiQuery({
    name: "cycleId",
    required: false,
    type: String,
    description: "A cycle of the caller's, for its execution weeks",
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: GetGoalExecutionResponse,
    description: "The execution score.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("week") week: string | undefined,
    @Query("cycleId") cycleId: string | undefined,
    @HeaderTimezone() tz: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: GetGoalExecutionResponse = {
      execution: await this.goals.execution(user.userId, { week, cycleId }, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
