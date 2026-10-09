import { ListGoalsForTodayResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
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
export class ListGoalsForTodayController {
  constructor(private readonly goals: GoalService) {}

  @Get("/goals/today")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists what is left to do on the signed-in user's goals today",
    description:
      "For the home widget, by goal type: habits due and not yet met today; milestone goals with their next milestone; outcome and achievement goals. A goal leaves its list for the day once it is met, has a milestone done or is checked in on today, and is listed under done instead. Only active goals that have started count. today is today in the caller's timezone.",
    operationId: "ListGoalsForToday",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: ListGoalsForTodayResponse,
    description: "Today's goals, left to do and done.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @HeaderTimezone() tz: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListGoalsForTodayResponse = await this.goals.today(
      user.userId,
      tz,
    );
    response.status(HttpStatus.OK).send(body);
  }
}
