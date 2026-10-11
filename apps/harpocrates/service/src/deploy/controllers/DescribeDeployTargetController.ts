import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { DescribeDeployTargetResponse } from "../../model/deployTargets";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { DeployService } from "../services/DeployService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeDeployTargetController {
  constructor(private readonly deploys: DeployService) {}

  @Get("/deploy-target/:targetId")
  @ApiOperation({
    summary: "Describes a deploy target",
    description: "A deploy target with its recent deployments, newest first.",
    operationId: "DescribeDeployTarget",
    tags: ["Deploy Targets"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "targetId",
    description: "The deploy target's ID",
    type: String,
  })
  @ApiOkResponse({
    description: "The deploy target.",
    type: DescribeDeployTargetResponse,
  })
  @ApiStandardErrorResponses({ include: [HttpStatus.FORBIDDEN] })
  @AnyPkiRole()
  async handle(
    @Param("targetId", ParseUUIDPipe) targetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeDeployTargetResponse = {
      deployTarget: await this.deploys.describe(targetId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
