import { ListGoalHabitsForDayResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
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
export class ListGoalHabitsForDayController {
  constructor(private readonly goals: GoalService) {}

  @Get("/goals/habits/:date")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's habits due on a day",
    description:
      "The active habit goals due on a day: each whose rule asks for one that day and whose week or month is not yet met, or that was logged that day, with the day's log and its period so far. today is today in the caller's timezone.",
    operationId: "ListGoalHabitsForDay",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
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
  @ApiOkResponse({
    type: ListGoalHabitsForDayResponse,
    description: "The habits due that day.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("date") date: string,
    @HeaderTimezone() tz: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListGoalHabitsForDayResponse = await this.goals.habitsForDay(
      user.userId,
      date,
      tz,
    );
    response.status(HttpStatus.OK).send(body);
  }
}
