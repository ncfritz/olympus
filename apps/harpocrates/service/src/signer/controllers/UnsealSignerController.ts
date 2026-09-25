import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly } from "../../auth/roles";
import { UnsealSignerRequest } from "../../model/signer";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SealService } from "../services/SealService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UnsealSignerController {
  constructor(private readonly seal: SealService) {}

  @Post("/signer/unseal")
  @ApiOperation({
    summary: "Unseals the signer",
    description:
      "Unseals the signer with the recovery passphrase, which also lifts a deliberate seal.",
    operationId: "UnsealSigner",
    tags: ["Signer"],
  })
  @ApiConsumes("application/json")
  @ApiBody({
    type: UnsealSignerRequest,
    required: true,
    description: "The recovery passphrase.",
  })
  @ApiNoContentResponse({ description: "The signer is unsealed." })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  @AdminOnly()
  async handle(
    @Body() request: UnsealSignerRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    await this.seal.unseal(principal, request.passphrase);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
