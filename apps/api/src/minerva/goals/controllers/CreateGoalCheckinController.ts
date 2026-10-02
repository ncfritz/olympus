import {
  CreateGoalCheckinRequest,
  CreateGoalCheckinResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
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
import { GoalCheckinService } from "../services/GoalCheckinService";

@Controller({ version: "1" })
export class CreateGoalCheckinController {
  constructor(private readonly goalCheckins: GoalCheckinService) {}

  @Post("/goal/:goalId/checkins")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Checks in on one of the signed-in user's goals",
    description:
      "Records where a goal stands on a day: today unless a past day is given, never a future one. An outcome goal's check-in needs a value; any other goal's needs a confidence. A closed goal takes no check-ins (409).",
    operationId: "CreateGoalCheckin",
    tags: ["Goals"],
  })
  @ApiConsumes("application/json")
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
  @ApiBody({
    type: CreateGoalCheckinRequest,
    required: true,
    description: "Input for the CreateGoalCheckin operation",
  })
  @ApiCreatedResponse({
    type: CreateGoalCheckinResponse,
    description: "The check-in was made.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The goal is closed.",
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
    @Body() request: CreateGoalCheckinRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CreateGoalCheckinResponse = {
      goalCheckin: await this.goalCheckins.create(
        user.userId,
        goalId,
        request?.goalCheckin,
        tz,
      ),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}
