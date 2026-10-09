import { ListGoalCheckinsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { GoalCheckinService } from "../services/GoalCheckinService";

@Controller({ version: "1" })
export class ListGoalCheckinsController {
  constructor(private readonly goalCheckins: GoalCheckinService) {}

  @Get("/goal/:goalId/checkins")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the check-ins on one of the signed-in user's goals",
    description:
      "A goal's check-ins, latest first, each with where it was made. Another user's goal is not found.",
    operationId: "ListGoalCheckins",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal",
    type: String,
  })
  @ApiOkResponse({
    type: ListGoalCheckinsResponse,
    description: "The goal's check-ins, latest first.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListGoalCheckinsResponse = {
      goalCheckins: await this.goalCheckins.list(user.userId, goalId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
