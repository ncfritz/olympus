import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly } from "../../auth/roles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { DeployService } from "../services/DeployService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DeleteDeployTargetController {
  constructor(private readonly deploys: DeployService) {}

  @Delete("/deploy-target/:targetId")
  @ApiOperation({
    summary: "Deletes a deploy target",
    description:
      "Stops renewing and deploying for the target. Its files stay where they are and are still served until the web server's configuration stops naming them.",
    operationId: "DeleteDeployTarget",
    tags: ["Deploy Targets"],
  })
  @ApiParam({
    name: "targetId",
    description: "The deploy target's ID",
    type: String,
  })
  @ApiNoContentResponse({ description: "The target is deleted." })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  async handle(
    @Param("targetId", ParseUUIDPipe) targetId: string,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    await this.deploys.remove(principal, targetId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
