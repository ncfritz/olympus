import {
  CreateGoalCycleRequest,
  CreateGoalCycleResponse,
} from "@ncfritz/olympus-model";
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
import { GoalCycleService } from "../services/GoalCycleService";
import { DescribeGoalCycleController } from "./DescribeGoalCycleController";

@Controller({ version: "1" })
export class CreateGoalCycleController {
  constructor(private readonly goalCycles: GoalCycleService) {}

  @Post("/goals/cycles")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Creates a goal cycle for the signed-in user",
    description:
      "Adds a 12-week cycle starting on a Monday, with a buffer week after it unless told otherwise. A cycle overlapping another of the caller's, buffer weeks included, is refused.",
    operationId: "CreateGoalCycle",
    tags: ["Goal Cycles"],
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
    type: CreateGoalCycleRequest,
    required: true,
    description: "Input for the CreateGoalCycle operation",
  })
  @ApiCreatedResponse({
    type: CreateGoalCycleResponse,
    description: "The cycle was created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created cycle",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The cycle would overlap another of the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @HeaderTimezone() tz: string,
    @Body() request: CreateGoalCycleRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const goalCycle = await this.goalCycles.create(
      user.userId,
      request?.goalCycle,
      tz,
    );
    setLocation(response, httpRequest, DescribeGoalCycleController, {
      cycleId: goalCycle.id,
    });
    const body: CreateGoalCycleResponse = { goalCycle };
    response.status(HttpStatus.CREATED).send(body);
  }
}
