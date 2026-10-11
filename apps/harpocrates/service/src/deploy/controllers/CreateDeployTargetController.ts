import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import {
  CreateDeployTargetRequest,
  CreateDeployTargetResponse,
} from "../../model/deployTargets";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { DeployService } from "../services/DeployService";
import { DescribeDeployTargetController } from "./DescribeDeployTargetController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateDeployTargetController {
  constructor(private readonly deploys: DeployService) {}

  @Post("/deploy-targets")
  @ApiOperation({
    summary: "Creates a deploy target",
    description:
      "Installs a certificate whose key Harpocrates generated and escrows in a directory of its own under DEPLOY_DIR, for a web server that reloads when it changes, and deploys it at once. From then on Harpocrates renews the certificate when due and deploys each renewal. Writing the key out is an escrow export: pki-admin only, after a recent sign-in, and recorded.",
    operationId: "CreateDeployTarget",
    tags: ["Deploy Targets"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateDeployTargetRequest,
    required: true,
    description: "Its name and certificate.",
  })
  @ApiCreatedResponse({
    description:
      "The target was created; its first deployment says whether it is installed yet.",
    type: CreateDeployTargetResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The target" },
    },
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
    ],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Body() request: CreateDeployTargetRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateDeployTargetResponse = {
      deployTarget: await this.deploys.create(principal, request),
    };
    setLocation(response, httpRequest, DescribeDeployTargetController, {
      targetId: responseBody.deployTarget.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
