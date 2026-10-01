import { DescribeGoalCycleResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
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
export class DescribeGoalCycleController {
  constructor(private readonly goalCycles: GoalCycleService) {}

  @Get("/goals/cycle/:cycleId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's goal cycles",
    description:
      "Returns a single cycle of the caller's, with where today falls against it. Another user's cycle is not found.",
    operationId: "DescribeGoalCycle",
    tags: ["Goal Cycles"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "cycleId",
    description: "The ID of the cycle",
    type: String,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: DescribeGoalCycleResponse,
    description: "The cycle was found.",
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
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeGoalCycleResponse = {
      goalCycle: await this.goalCycles.describe(user.userId, cycleId, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
