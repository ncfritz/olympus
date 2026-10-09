import { Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly } from "../../auth/roles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SealService } from "../services/SealService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class SealSignerController {
  constructor(private readonly seal: SealService) {}

  @Post("/signer/seal")
  @ApiOperation({
    summary: "Seals the signer",
    description:
      "Has the signer forget its keys and end any ceremony. It stays sealed across restarts until unsealed with the recovery passphrase.",
    operationId: "SealSigner",
    tags: ["Signer"],
  })
  @ApiNoContentResponse({ description: "The signer is sealed." })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  @AdminOnly()
  async handle(
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    await this.seal.seal(principal);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
