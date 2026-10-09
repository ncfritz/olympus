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
import { DiscardIssuerResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerService } from "../services/IssuerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DiscardIssuerController {
  constructor(private readonly issuers: IssuerService) {}

  @Post("/issuer/:issuerId/discard")
  @ApiOperation({
    summary: "Discards a root that has signed nothing",
    description:
      "Discards a root with no CA, certificate or list beneath it (ADR 0032): its backup did not prove, or it was made by mistake. It is revoked in the record, never published, and its number is not used again.",
    operationId: "DiscardIssuer",
    tags: ["Issuers"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The root's slug", type: String })
  @ApiOkResponse({
    description: "The root was discarded.",
    type: DiscardIssuerResponse,
  })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
    ],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("issuerId") issuerId: string,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DiscardIssuerResponse = {
      issuer: await this.issuers.discard(principal, issuerId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
