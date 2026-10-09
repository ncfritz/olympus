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
import { ImportIssuerRequest, ImportIssuerResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { IssuerService } from "../services/IssuerService";
import { DescribeIssuerController } from "./DescribeIssuerController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ImportIssuerController {
  constructor(private readonly issuers: IssuerService) {}

  @Post("/issuers/import")
  @ApiOperation({
    summary: "Imports a certificate authority",
    description:
      "Imports an existing CA, parents first: a root or intermediate by its certificate alone (its key stays offline), an issuing CA with its encrypted key, which goes to the signer.",
    operationId: "ImportIssuer",
    tags: ["Issuers"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ImportIssuerRequest,
    required: true,
    description: "The CA to import.",
  })
  @ApiCreatedResponse({
    description: "The CA was imported.",
    type: ImportIssuerResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The imported CA" },
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
    @Body() request: ImportIssuerRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ImportIssuerResponse = {
      issuer: await this.issuers.import(principal, request),
    };
    setLocation(response, httpRequest, DescribeIssuerController, {
      issuerId: responseBody.issuer.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
