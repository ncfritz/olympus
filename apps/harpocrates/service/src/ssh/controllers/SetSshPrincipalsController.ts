import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
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
  SetSshPrincipalsRequest,
  SetSshPrincipalsResponse,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshPrincipalService } from "../services/SshPrincipalService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class SetSshPrincipalsController {
  constructor(private readonly principals: SshPrincipalService) {}

  @Put("/ssh/principals/:identity")
  @ApiOperation({
    summary: "Sets who an identity may log in as",
    description:
      "Replaces an Olympus identity's SSH principals (ADR 0035); none removes its mapping. Certificates already issued keep theirs until they expire or are revoked.",
    operationId: "SetSshPrincipals",
    tags: ["SSH"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "identity",
    description: "The identity's email",
    type: String,
  })
  @ApiBody({
    type: SetSshPrincipalsRequest,
    required: true,
    description: "Its principals.",
  })
  @ApiOkResponse({
    description: "The mapping, as it now is.",
    type: SetSshPrincipalsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("identity") identity: string,
    @Body() request: SetSshPrincipalsRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SetSshPrincipalsResponse = {
      mapping: await this.principals.set(
        principal,
        identity,
        request.principals,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
