import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
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
export class DeleteGoalHabitLogController {
  constructor(private readonly goalHabits: GoalHabitService) {}

  @Delete("/goal/:goalId/habit/:date")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Clears a day of one of the signed-in user's habits",
    description: "Removes a habit goal's log for a day.",
    operationId: "DeleteGoalHabitLog",
    tags: ["Goals"],
  })
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
  @ApiNoContentResponse({ description: "The day's log was removed." })
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
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.goalHabits.deleteLog(user.userId, goalId, date, tz);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
