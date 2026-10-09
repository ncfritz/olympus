import {
  EmptyResponse,
  UpdateGoalCycleRequest,
  UpdateGoalCycleResponse,
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
import { GoalCycleService } from "../services/GoalCycleService";

@Controller({ version: "1" })
export class UpdateGoalCycleController {
  constructor(private readonly goalCycles: GoalCycleService) {}

  @Put("/goals/cycle/:cycleId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's goal cycles",
    description:
      "Renames a cycle or moves or resizes it. A change that would overlap another of the caller's cycles is refused.",
    operationId: "UpdateGoalCycle",
    tags: ["Goal Cycles"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "cycleId",
    description: "The ID of the cycle to change",
    type: String,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiBody({
    type: UpdateGoalCycleRequest,
    required: true,
    description: "Input for the UpdateGoalCycle operation",
  })
  @ApiOkResponse({
    type: UpdateGoalCycleResponse,
    description: "The cycle with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The changed cycle would overlap another of the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("cycleId", ParseUUIDPipe) cycleId: string,
    @HeaderTimezone() tz: string,
    @Body() request: UpdateGoalCycleRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goalCycle = await this.goalCycles.update(
      user.userId,
      cycleId,
      request?.goalCycle,
      tz,
    );
    if (!goalCycle) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateGoalCycleResponse = { goalCycle };
    response.status(HttpStatus.OK).send(body);
  }
}
