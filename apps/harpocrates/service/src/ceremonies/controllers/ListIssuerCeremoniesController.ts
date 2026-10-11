import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AdminOnly } from "../../auth/roles";
import { ListIssuerCeremoniesResponse } from "../../model/ceremonies";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CeremonyService } from "../services/CeremonyService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListIssuerCeremoniesController {
  constructor(private readonly ceremonies: CeremonyService) {}

  @Get("/issuer/:issuerId/ceremonies")
  @ApiOperation({
    summary: "Lists a CA's ceremonies",
    description:
      "An offline CA's ceremonies, newest first: who opened each, when it opened and closed, and how many revocation lists it signed.",
    operationId: "ListIssuerCeremonies",
    tags: ["Ceremonies"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiOkResponse({
    description: "The ceremonies.",
    type: ListIssuerCeremoniesResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  async handle(
    @Param("issuerId") issuerId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListIssuerCeremoniesResponse = {
      ceremonies: await this.ceremonies.listForIssuer(issuerId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
