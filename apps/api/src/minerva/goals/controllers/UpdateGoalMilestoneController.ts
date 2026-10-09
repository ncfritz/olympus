import {
  EmptyResponse,
  UpdateGoalMilestoneRequest,
  UpdateGoalMilestoneResponse,
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
import { GoalMilestoneService } from "../services/GoalMilestoneService";

@Controller({ version: "1" })
export class UpdateGoalMilestoneController {
  constructor(private readonly goalMilestones: GoalMilestoneService) {}

  @Put("/goal/:goalId/milestone/:milestoneId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes a milestone of one of the signed-in user's goals",
    description:
      "Renames, redates or reweighs a milestone, or ticks it done or not done.",
    operationId: "UpdateGoalMilestone",
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
    name: "milestoneId",
    description: "The ID of the milestone",
    type: String,
  })
  @ApiBody({
    type: UpdateGoalMilestoneRequest,
    required: true,
    description: "Input for the UpdateGoalMilestone operation",
  })
  @ApiOkResponse({
    type: UpdateGoalMilestoneResponse,
    description: "The milestone with the changes applied.",
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
    @Param("milestoneId", ParseUUIDPipe) milestoneId: string,
    @Body() request: UpdateGoalMilestoneRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goalMilestone = await this.goalMilestones.update(
      user.userId,
      goalId,
      milestoneId,
      request?.goalMilestone,
    );
    if (!goalMilestone) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateGoalMilestoneResponse = { goalMilestone };
    response.status(HttpStatus.OK).send(body);
  }
}
