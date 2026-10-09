import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import {
  CreateRootIssuerRequest,
  CreateRootIssuerResponse,
} from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { IssuerService } from "../services/IssuerService";
import { DescribeIssuerController } from "./DescribeIssuerController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateRootIssuerController {
  constructor(private readonly issuers: IssuerService) {}

  @Post("/issuers/roots")
  @ApiOperation({
    summary: "Creates a root",
    description:
      "Creates a root CA: the signer generates its key and self-signs, and the key is returned encrypted, once; Harpocrates keeps no copy. Its shape (three_tier, two_tier, direct) sets its path length and what its ceremonies sign (ADR 0032); every other setting takes its default unless given. Its first ceremony proves the key's backup and signs its first list.",
    operationId: "CreateRootIssuer",
    tags: ["Issuers"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateRootIssuerRequest,
    required: true,
    description:
      "The root's shape, number, generation and export passphrase, and any settings instead of their defaults.",
  })
  @ApiCreatedResponse({
    description: "The root was created.",
    type: CreateRootIssuerResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The new CA" },
    },
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Body() request: CreateRootIssuerRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateRootIssuerResponse =
      await this.issuers.createRoot(principal, request);
    setLocation(response, httpRequest, DescribeIssuerController, {
      issuerId: responseBody.issuer.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
