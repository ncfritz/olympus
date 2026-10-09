import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
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
import { CeremonyService } from "../services/CeremonyService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CloseCeremonyController {
  constructor(private readonly ceremonies: CeremonyService) {}

  @Delete("/ceremony/:ceremonyId")
  @ApiOperation({
    summary: "Closes a ceremony",
    description:
      "Has the signer forget the offline CA's key. Closing one the signer has already ended is not an error.",
    operationId: "CloseCeremony",
    tags: ["Ceremonies"],
  })
  @ApiParam({
    name: "ceremonyId",
    description: "The ceremony's ID",
    type: String,
  })
  @ApiNoContentResponse({ description: "The ceremony is closed." })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN, HttpStatus.SERVICE_UNAVAILABLE],
  })
  @AdminOnly()
  async handle(
    @Param("ceremonyId") ceremonyId: string,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    await this.ceremonies.close(principal, ceremonyId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
