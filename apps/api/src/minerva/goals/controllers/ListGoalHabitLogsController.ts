import { ListGoalHabitLogsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { GoalHabitService } from "../services/GoalHabitService";

@Controller({ version: "1" })
export class ListGoalHabitLogsController {
  constructor(private readonly goalHabits: GoalHabitService) {}

  @Get("/goal/:goalId/habit")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the logs of one of the signed-in user's habits",
    description:
      "A habit goal's logs from one day to another, the last twelve weeks by default, with its adherence and current and best streaks as of today in the caller's timezone.",
    operationId: "ListGoalHabitLogs",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal",
    type: String,
  })
  @ApiQuery({
    name: "from",
    required: false,
    type: String,
    description:
      "The first day, as YYYY-MM-DD; twelve weeks before to when absent",
  })
  @ApiQuery({
    name: "to",
    required: false,
    type: String,
    description: "The last day, as YYYY-MM-DD; today when absent",
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: ListGoalHabitLogsResponse,
    description: "The habit's logs and where it stands.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @HeaderTimezone() tz: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const { logs, summary } = await this.goalHabits.listLogs(
      user.userId,
      goalId,
      { from, to },
      tz,
    );
    const body: ListGoalHabitLogsResponse = { goalHabitLogs: logs, summary };
    response.status(HttpStatus.OK).send(body);
  }
}
