import {
  CreateGoalMilestoneRequest,
  CreateGoalMilestoneResponse,
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
export class CreateGoalMilestoneController {
  constructor(private readonly goalMilestones: GoalMilestoneService) {}

  @Post("/goal/:goalId/milestones")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Adds a milestone to one of the signed-in user's goals",
    description: "Adds a milestone at the end of a milestone goal's list.",
    operationId: "CreateGoalMilestone",
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
    type: CreateGoalMilestoneRequest,
    required: true,
    description: "Input for the CreateGoalMilestone operation",
  })
  @ApiCreatedResponse({
    type: CreateGoalMilestoneResponse,
    description: "The milestone was added.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Body() request: CreateGoalMilestoneRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CreateGoalMilestoneResponse = {
      goalMilestone: await this.goalMilestones.create(
        user.userId,
        goalId,
        request?.goalMilestone,
      ),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}
