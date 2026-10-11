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
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import {
  UpdateDeployTargetRequest,
  UpdateDeployTargetResponse,
} from "../../model/deployTargets";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { DeployService } from "../services/DeployService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UpdateDeployTargetController {
  constructor(private readonly deploys: DeployService) {}

  @Put("/deploy-target/:targetId")
  @ApiOperation({
    summary: "Updates a deploy target",
    description:
      "Points a deploy target at another certificate, a reissue after a revocation say, and deploys it at once (renewals it follows by itself); or at another endpoint, checked from then on. pki-admin only, after a recent sign-in, as for any escrow export.",
    operationId: "UpdateDeployTarget",
    tags: ["Deploy Targets"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "targetId",
    description: "The deploy target's ID",
    type: String,
  })
  @ApiBody({
    type: UpdateDeployTargetRequest,
    required: true,
    description: "Its certificate, its endpoint, or both, from now on.",
  })
  @ApiOkResponse({
    description:
      "The target was updated; its newest deployment says whether the certificate is installed yet.",
    type: UpdateDeployTargetResponse,
  })
  @ApiStandardErrorResponses({
    include: [HttpStatus.FORBIDDEN, HttpStatus.UNPROCESSABLE_ENTITY],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("targetId", ParseUUIDPipe) targetId: string,
    @Body() request: UpdateDeployTargetRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateDeployTargetResponse = {
      deployTarget: await this.deploys.update(principal, targetId, request),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
