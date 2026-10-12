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
import { ListIssuerOcspRespondersResponse } from "../../model/ocsp";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OcspResponderService } from "../services/OcspResponderService";
import { OcspResponseService } from "../services/OcspResponseService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListIssuerOcspRespondersController {
  constructor(
    private readonly responders: OcspResponderService,
    private readonly responses: OcspResponseService,
  ) {}

  @Get("/issuer/:issuerId/ocsp-responders")
  @ApiOperation({
    summary: "Lists a CA's OCSP responders",
    description:
      "The CA's OCSP responders, newest first (ADR 0036), and how fresh its stored responses are: how many, how many revoked, the soonest to lapse and the latest signed.",
    operationId: "ListIssuerOcspResponders",
    tags: ["OCSP"],
  })
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The responders and responses.",
    type: ListIssuerOcspRespondersResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("issuerId") issuerId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListIssuerOcspRespondersResponse = {
      responders: await this.responders.list(issuerId),
      responses: await this.responses.summary(issuerId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
