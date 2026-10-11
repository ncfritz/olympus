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
import { UpdateIssuerRequest, UpdateIssuerResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerService } from "../services/IssuerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UpdateIssuerController {
  constructor(private readonly issuers: IssuerService) {}

  @Put("/issuer/:issuerId")
  @ApiOperation({
    summary: "Edits a CA",
    description:
      "Changes what can change once a CA exists: its issuer alternative names (ADR 0034), which the certificates it signs carry where their profile version says. What is given replaces what it had; what is not given stays.",
    operationId: "UpdateIssuer",
    tags: ["Issuers"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiBody({
    type: UpdateIssuerRequest,
    required: true,
    description: "What changes.",
  })
  @ApiOkResponse({
    description: "The CA, as it now is.",
    type: UpdateIssuerResponse,
  })
  @ApiStandardErrorResponses({
    include: [HttpStatus.FORBIDDEN, HttpStatus.UNPROCESSABLE_ENTITY],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("issuerId") issuerId: string,
    @Body() request: UpdateIssuerRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateIssuerResponse = {
      issuer: await this.issuers.update(principal, issuerId, request),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
