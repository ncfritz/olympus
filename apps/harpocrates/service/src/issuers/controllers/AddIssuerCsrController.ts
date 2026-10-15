import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
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
import { AdminOnly } from "../../auth/roles";
import { AddIssuerCsrRequest, AddIssuerCsrResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerService } from "../services/IssuerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class AddIssuerCsrController {
  constructor(private readonly issuers: IssuerService) {}

  @Post("/issuer/:issuerId/csr")
  @ApiOperation({
    summary: "Gives an imported CA its CSR",
    description:
      "Keeps the CSR an imported CA's certificate was issued from, while it has none (ADR 0039). The CSR must be signed by the key its certificate certifies.",
    operationId: "AddIssuerCsr",
    tags: ["Issuers"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiBody({
    type: AddIssuerCsrRequest,
    required: true,
    description: "The CSR, PEM.",
  })
  @ApiOkResponse({ description: "The CA.", type: AddIssuerCsrResponse })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
    ],
  })
  @AdminOnly()
  async handle(
    @Param("issuerId") issuerId: string,
    @Body() request: AddIssuerCsrRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: AddIssuerCsrResponse = {
      issuer: await this.issuers.addCsr(principal, issuerId, request.csr),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
