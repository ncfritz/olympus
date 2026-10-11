import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { ListDeployTargetsResponse } from "../../model/deployTargets";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { DeployService } from "../services/DeployService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListDeployTargetsController {
  constructor(private readonly deploys: DeployService) {}

  @Get("/deploy-targets")
  @ApiOperation({
    summary: "Lists deploy targets",
    description:
      "Every deploy target by name, with its certificate, when Harpocrates renews it, and its newest deployment.",
    operationId: "ListDeployTargets",
    tags: ["Deploy Targets"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The deploy targets.",
    type: ListDeployTargetsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListDeployTargetsResponse = {
      deployTargets: await this.deploys.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
