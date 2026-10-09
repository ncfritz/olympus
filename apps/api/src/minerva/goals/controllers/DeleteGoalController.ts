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
import { GoalService } from "../services/GoalService";

@Controller({ version: "1" })
export class DeleteGoalController {
  constructor(private readonly goals: GoalService) {}

  @Delete("/goal/:goalId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's goals",
    description:
      "Deletes a goal so that it can be restored. A goal with sub-goals that are not deleted cannot be deleted.",
    operationId: "DeleteGoal",
    tags: ["Goals"],
  })
  @ApiParam({
    name: "goalId",
    description: "The ID of the goal to delete",
    type: String,
  })
  @ApiNoContentResponse({ description: "The goal was deleted." })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The goal has sub-goals that are not deleted.",
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
    await this.goals.delete(user.userId, goalId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
