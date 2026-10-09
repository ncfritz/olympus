import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import {
  InitialiseSignerRequest,
  InitialiseSignerResponse,
} from "../../model/signer";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SealService } from "../services/SealService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class InitialiseSignerController {
  constructor(private readonly seal: SealService) {}

  @Post("/signer/initialise")
  @ApiOperation({
    summary: "Initialises the signer",
    description:
      "Sets the recovery passphrase on an empty signer and returns its unseal key, once (ADR 0032). The key becomes the harpocrates_signer_unseal_key secret; after a restart the signer unseals itself with it. Refused on a signer that already has a master key.",
    operationId: "InitialiseSigner",
    tags: ["Signer"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: InitialiseSignerRequest,
    required: true,
    description: "The recovery passphrase to set.",
  })
  @ApiCreatedResponse({
    description: "The signer is initialised.",
    type: InitialiseSignerResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Body() request: InitialiseSignerRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: InitialiseSignerResponse = {
      unsealKey: await this.seal.initialise(principal, request.passphrase),
    };
    // Never cached anywhere between here and the console.
    response.setHeader("Cache-Control", "no-store");
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
