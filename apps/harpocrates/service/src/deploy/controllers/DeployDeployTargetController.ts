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
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AnyPkiRole } from "../../auth/roles";
import { DeployDeployTargetResponse } from "../../model/deployTargets";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { DeployService } from "../services/DeployService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DeployDeployTargetController {
  constructor(private readonly deploys: DeployService) {}

  @Post("/deploy-target/:targetId/deploy")
  @ApiOperation({
    summary: "Deploys a deploy target again",
    description:
      "Deploys the target's certificate again, now, to the place it already has: after its files were lost, or rather than wait for a retry.",
    operationId: "DeployDeployTarget",
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
      "The deployment was tried; the newest says whether it succeeded.",
    type: DeployDeployTargetResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN, HttpStatus.UNPROCESSABLE_ENTITY],
  })
  @AnyPkiRole()
  async handle(
    @Param("targetId", ParseUUIDPipe) targetId: string,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DeployDeployTargetResponse = {
      deployTarget: await this.deploys.redeploy(principal, targetId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
