import { SuggestGoalCheckinResponse } from "@ncfritz/olympus-model";
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
export class SuggestGoalCheckinController {
  constructor(private readonly goals: GoalService) {}

  @Get("/goal/:goalId/checkin/suggestion")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Suggests a check-in for one of the signed-in user's goals",
    description:
      "The check-in form's defaults for today in the caller's timezone: the goal's progress and current value, where pace says it should be, and the confidence those numbers suggest.",
    operationId: "SuggestGoalCheckin",
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
    type: SuggestGoalCheckinResponse,
    description: "The check-in form's defaults.",
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
    const body: SuggestGoalCheckinResponse = {
      suggestion: await this.goals.suggestCheckin(user.userId, goalId, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
