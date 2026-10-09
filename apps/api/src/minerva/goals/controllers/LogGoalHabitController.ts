import {
  LogGoalHabitRequest,
  LogGoalHabitResponse,
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
import { GoalHabitService } from "../services/GoalHabitService";

@Controller({ version: "1" })
export class LogGoalHabitController {
  constructor(private readonly goalHabits: GoalHabitService) {}

  @Put("/goal/:goalId/habit/:date")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Logs a day of one of the signed-in user's habits",
    description:
      "Records a habit goal's day, replacing any log already there: marked done, or a quantity towards the rule's target. The day is the caller's local day and not after today; a day before the goal started, or after it closed, is refused.",
    operationId: "LogGoalHabit",
    tags: ["Goals"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal",
    type: String,
  })
  @ApiParam({
    name: "date",
    description:
      "The day, as YYYY-MM-DD or today; not after today in the caller's timezone",
    type: String,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiBody({
    type: LogGoalHabitRequest,
    required: false,
    description: "Input for the LogGoalHabit operation",
  })
  @ApiOkResponse({
    type: LogGoalHabitResponse,
    description: "The day's log as saved.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Param("date") date: string,
    @HeaderTimezone() tz: string,
    @Body() request: LogGoalHabitRequest | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: LogGoalHabitResponse = {
      goalHabitLog: await this.goalHabits.log(
        user.userId,
        goalId,
        date,
        request?.goalHabitLog,
        tz,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
