import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { ListIssuerCrlsResponse } from "../../model/crls";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CrlService } from "../services/CrlService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListIssuerCrlsController {
  constructor(private readonly crls: CrlService) {}

  @Get("/issuer/:issuerId/crls")
  @ApiOperation({
    summary: "Lists a CA's revocation lists",
    description:
      "The CA's lists, newest first (the last 100): their numbers, validity, where each came from, and whether it is published or why publishing it failed.",
    operationId: "ListIssuerCrls",
    tags: ["Revocation Lists"],
  })
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiProduces("application/json")
  @ApiOkResponse({ description: "The lists.", type: ListIssuerCrlsResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("issuerId") issuerId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListIssuerCrlsResponse = {
      crls: await this.crls.list(issuerId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
