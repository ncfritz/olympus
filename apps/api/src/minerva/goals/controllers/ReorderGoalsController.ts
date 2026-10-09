import {
  ReorderGoalsRequest,
  ReorderGoalsResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
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
import { GoalService } from "../services/GoalService";

@Controller({ version: "1" })
export class ReorderGoalsController {
  constructor(private readonly goals: GoalService) {}

  @Put("/goals/order")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reorders some of the signed-in user's goals",
    description:
      "Puts the goals named in the order given, sharing out the positions they already hold among them, so one list can be reordered without naming every goal.",
    operationId: "ReorderGoals",
    tags: ["Goals"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiBody({
    type: ReorderGoalsRequest,
    required: true,
    description: "Input for the ReorderGoals operation",
  })
  @ApiOkResponse({
    type: ReorderGoalsResponse,
    description: "The goals named, in their new order.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @HeaderTimezone() tz: string,
    @Body() request: ReorderGoalsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ReorderGoalsResponse = {
      goals: await this.goals.reorder(user.userId, request?.goalIds, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
