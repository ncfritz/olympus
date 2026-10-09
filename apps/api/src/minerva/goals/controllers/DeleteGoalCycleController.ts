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
import { GoalCycleService } from "../services/GoalCycleService";

@Controller({ version: "1" })
export class DeleteGoalCycleController {
  constructor(private readonly goalCycles: GoalCycleService) {}

  @Delete("/goals/cycle/:cycleId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's goal cycles",
    description:
      "Removes a cycle from the caller's list. Goals set for it keep their dates and become custom goals.",
    operationId: "DeleteGoalCycle",
    tags: ["Goal Cycles"],
  })
  @ApiParam({
    name: "cycleId",
    description: "The ID of the cycle to delete",
    type: String,
  })
  @ApiNoContentResponse({ description: "The cycle was deleted." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("cycleId", ParseUUIDPipe) cycleId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.goalCycles.delete(user.userId, cycleId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
