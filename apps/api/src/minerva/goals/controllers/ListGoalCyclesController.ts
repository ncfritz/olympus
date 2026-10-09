import { ListGoalCyclesResponse } from "@ncfritz/olympus-model";
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
import { GoalCycleService } from "../services/GoalCycleService";

@Controller({ version: "1" })
export class ListGoalCyclesController {
  constructor(private readonly goalCycles: GoalCycleService) {}

  @Get("/goals/cycles")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's goal cycles",
    description:
      "Every 12-week cycle the caller has, latest first, each marked with where today falls against it and, while it runs, today's week.",
    operationId: "ListGoalCycles",
    tags: ["Goal Cycles"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: ListGoalCyclesResponse,
    description: "The caller's cycles.",
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
    const body: ListGoalCyclesResponse = {
      goalCycles: await this.goalCycles.list(user.userId, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
