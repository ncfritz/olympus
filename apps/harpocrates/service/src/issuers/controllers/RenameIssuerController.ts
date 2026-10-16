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
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import { RenameIssuerRequest, RenameIssuerResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerService } from "../services/IssuerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class RenameIssuerController {
  constructor(private readonly issuers: IssuerService) {}

  @Post("/issuer/:issuerId/rename")
  @ApiOperation({
    summary: "Gives an imported CA another ID",
    description:
      "Corrects the ID an offline CA imported from another CA product was given (ADR 0042), while nothing it signed names its URLs under the old one. Everything referencing it follows, its list and certificate URLs are made from the new ID, and its published files move to the new names.",
    operationId: "RenameIssuer",
    tags: ["Issuers"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiBody({
    type: RenameIssuerRequest,
    required: true,
    description: "Its new ID.",
  })
  @ApiOkResponse({
    description: "The CA, under its new ID.",
    type: RenameIssuerResponse,
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
    @Body() request: RenameIssuerRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RenameIssuerResponse = {
      issuer: await this.issuers.rename(principal, issuerId, request.id),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
