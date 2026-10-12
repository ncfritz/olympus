import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
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
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import { RetireSshCaResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshCaService } from "../services/SshCaService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class RetireSshCaController {
  constructor(private readonly cas: SshCaService) {}

  @Post("/ssh/ca/:caId/retire")
  @ApiOperation({
    summary: "Retires an SSH CA",
    description:
      "It signs nothing more; hosts and clients keep trusting it until its last certificate expires, then its line can go.",
    operationId: "RetireSshCa",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "caId", description: "The CA's slug", type: String })
  @ApiOkResponse({ description: "The CA.", type: RetireSshCaResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("caId") caId: string,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RetireSshCaResponse = {
      ca: await this.cas.retire(principal, caId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
