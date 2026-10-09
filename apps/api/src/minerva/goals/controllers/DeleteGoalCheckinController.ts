import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { GoalCheckinService } from "../services/GoalCheckinService";

@Controller({ version: "1" })
export class DeleteGoalCheckinController {
  constructor(private readonly goalCheckins: GoalCheckinService) {}

  @Delete("/goal/:goalId/checkin/:checkinId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Removes a check-in from one of the signed-in user's goals",
    description:
      "Removes a check-in; the goal's progress and health follow the check-ins left.",
    operationId: "DeleteGoalCheckin",
    tags: ["Goals"],
  })
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
  @ApiNoContentResponse({ description: "The check-in was removed." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Param("checkinId", ParseUUIDPipe) checkinId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.goalCheckins.delete(user.userId, goalId, checkinId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
