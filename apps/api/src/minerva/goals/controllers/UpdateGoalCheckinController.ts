import {
  EmptyResponse,
  UpdateGoalCheckinRequest,
  UpdateGoalCheckinResponse,
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
import { GoalCheckinService } from "../services/GoalCheckinService";

@Controller({ version: "1" })
export class UpdateGoalCheckinController {
  constructor(private readonly goalCheckins: GoalCheckinService) {}

  @Put("/goal/:goalId/checkin/:checkinId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes a check-in on one of the signed-in user's goals",
    description:
      "Changes a check-in's day, value, confidence or note; the check-in as it would stand must still be valid.",
    operationId: "UpdateGoalCheckin",
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
    name: "checkinId",
    description: "The ID of the check-in",
    type: String,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiBody({
    type: UpdateGoalCheckinRequest,
    required: true,
    description: "Input for the UpdateGoalCheckin operation",
  })
  @ApiOkResponse({
    type: UpdateGoalCheckinResponse,
    description: "The check-in with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Param("checkinId", ParseUUIDPipe) checkinId: string,
    @HeaderTimezone() tz: string,
    @Body() request: UpdateGoalCheckinRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goalCheckin = await this.goalCheckins.update(
      user.userId,
      goalId,
      checkinId,
      request?.goalCheckin,
      tz,
    );
    if (!goalCheckin) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateGoalCheckinResponse = { goalCheckin };
    response.status(HttpStatus.OK).send(body);
  }
}
