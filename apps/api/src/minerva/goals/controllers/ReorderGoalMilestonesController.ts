import {
  ReorderGoalMilestonesRequest,
  ReorderGoalMilestonesResponse,
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
export class ReorderGoalMilestonesController {
  constructor(private readonly goalMilestones: GoalMilestoneService) {}

  @Put("/goal/:goalId/milestones/order")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reorders the milestones of one of the signed-in user's goals",
    description:
      "Puts a goal's milestones in the order given, which must name every one of them exactly once.",
    operationId: "ReorderGoalMilestones",
    tags: ["Goals"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal",
    type: String,
  })
  @ApiBody({
    type: ReorderGoalMilestonesRequest,
    required: true,
    description: "Input for the ReorderGoalMilestones operation",
  })
  @ApiOkResponse({
    type: ReorderGoalMilestonesResponse,
    description: "The goal's milestones in their new order.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Body() request: ReorderGoalMilestonesRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ReorderGoalMilestonesResponse = {
      goalMilestones: await this.goalMilestones.reorder(
        user.userId,
        goalId,
        request?.milestoneIds,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
