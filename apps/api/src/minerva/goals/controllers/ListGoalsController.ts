import { ListGoalsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
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
export class ListGoalsController {
  constructor(private readonly goals: GoalService) {}

  @Get("/goals")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's goals",
    description:
      "The caller's goals that match, in order, each with its progress, where pace says it should be, its health and its sub-goals' IDs, worked out for today in the caller's timezone. Open goals (draft, active, paused) unless told otherwise.",
    operationId: "ListGoals",
    tags: ["Goals"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
    description:
      "Comma-separated statuses to include, e.g. achieved,missed; draft, active and paused when absent",
  })
  @ApiQuery({
    name: "categoryId",
    required: false,
    type: String,
    description: "Only goals in this category",
  })
  @ApiQuery({
    name: "cycleId",
    required: false,
    type: String,
    description: "Only goals set for this cycle",
  })
  @ApiQuery({
    name: "horizon",
    required: false,
    type: String,
    description:
      "Only goals with this horizon: year, quarter, cycle, custom or ongoing",
  })
  @ApiQuery({
    name: "tagId",
    required: false,
    type: String,
    description: "Only goals with this tag",
  })
  @ApiQuery({
    name: "parentId",
    required: false,
    type: String,
    description: "Only sub-goals of this goal, or none for top-level goals",
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: ListGoalsResponse,
    description: "The caller's goals that match.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("status") status: string | undefined,
    @Query("categoryId") categoryId: string | undefined,
    @Query("cycleId") cycleId: string | undefined,
    @Query("horizon") horizon: string | undefined,
    @Query("tagId") tagId: string | undefined,
    @Query("parentId") parentId: string | undefined,
    @HeaderTimezone() tz: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListGoalsResponse = {
      goals: await this.goals.list(
        user.userId,
        { status, categoryId, cycleId, horizon, tagId, parentId },
        tz,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
