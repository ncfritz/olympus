import { CreateGoalRequest, CreateGoalResponse } from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { GoalService } from "../services/GoalService";
import { DescribeGoalController } from "./DescribeGoalController";

@Controller({ version: "1" })
export class CreateGoalController {
  constructor(private readonly goals: GoalService) {}

  @Post("/goals")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Creates a goal for the signed-in user",
    description:
      "Creates a goal with its habit rule, milestones and tags in one step, after the caller's other goals. The progress mode defaults by type, and a cycle goal with no dates takes its cycle's.",
    operationId: "CreateGoal",
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
    type: CreateGoalRequest,
    required: true,
    description: "Input for the CreateGoal operation",
  })
  @ApiCreatedResponse({
    type: CreateGoalResponse,
    description: "The goal was created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created goal",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @HeaderTimezone() tz: string,
    @Body() request: CreateGoalRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goal = await this.goals.create(user.userId, request, tz);
    setLocation(response, httpRequest, DescribeGoalController, {
      goalId: goal.id,
    });
    const body: CreateGoalResponse = { goal };
    response.status(HttpStatus.CREATED).send(body);
  }
}
