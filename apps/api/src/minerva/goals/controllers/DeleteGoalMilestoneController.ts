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
import { GoalMilestoneService } from "../services/GoalMilestoneService";

@Controller({ version: "1" })
export class DeleteGoalMilestoneController {
  constructor(private readonly goalMilestones: GoalMilestoneService) {}

  @Delete("/goal/:goalId/milestone/:milestoneId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Removes a milestone from one of the signed-in user's goals",
    description: "Removes a milestone from a goal's list.",
    operationId: "DeleteGoalMilestone",
    tags: ["Goals"],
  })
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal",
    type: String,
  })
  @ApiParam({
    name: "milestoneId",
    description: "The ID of the milestone",
    type: String,
  })
  @ApiNoContentResponse({ description: "The milestone was removed." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Param("milestoneId", ParseUUIDPipe) milestoneId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.goalMilestones.delete(user.userId, goalId, milestoneId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
