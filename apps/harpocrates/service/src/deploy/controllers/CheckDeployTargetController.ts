import {
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { CheckDeployTargetResponse } from "../../model/deployTargets";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { DeployService } from "../services/DeployService";
import { EndpointCheckService } from "../services/EndpointCheckService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CheckDeployTargetController {
  constructor(
    private readonly deploys: DeployService,
    private readonly endpoints: EndpointCheckService,
  ) {}

  @Post("/deploy-target/:targetId/check")
  @ApiOperation({
    summary: "Checks a deploy target's endpoint",
    description:
      "Connects to the target's endpoint now and records which certificate it serves: the target's, one it deployed before, another, or none.",
    operationId: "CheckDeployTarget",
    tags: ["Deploy Targets"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "targetId",
    description: "The deploy target's ID",
    type: String,
  })
  @ApiOkResponse({
    description:
      "The endpoint was checked; its newest observation says what it served.",
    type: CheckDeployTargetResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("targetId", ParseUUIDPipe) targetId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.endpoints.check(targetId);
    const responseBody: CheckDeployTargetResponse = {
      deployTarget: await this.deploys.describe(targetId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
