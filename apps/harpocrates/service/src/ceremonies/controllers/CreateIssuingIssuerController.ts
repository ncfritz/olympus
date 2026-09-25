import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import { DescribeIssuerController } from "../../issuers/controllers/DescribeIssuerController";
import { CreateIssuingIssuerResponse } from "../../model/ceremonies";
import { CreateIssuingIssuerRequest } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { CeremonyService } from "../services/CeremonyService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateIssuingIssuerController {
  constructor(private readonly ceremonies: CeremonyService) {}

  @Post("/ceremony/:ceremonyId/issuing")
  @ApiOperation({
    summary: "Creates an issuing CA in a ceremony",
    description:
      "Creates an online issuing CA below the ceremony's intermediate: its key is generated in the signer's store, the intermediate signs it, and it is registered to sign certificates.",
    operationId: "CreateIssuingIssuer",
    tags: ["Ceremonies"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "ceremonyId",
    description: "The open ceremony",
    type: String,
  })
  @ApiBody({
    type: CreateIssuingIssuerRequest,
    required: true,
    description:
      "The issuing CA's purpose, number, generation, usages, constraints and maximum validity.",
  })
  @ApiCreatedResponse({
    description: "The issuing CA was created.",
    type: CreateIssuingIssuerResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The new CA" },
    },
  })
  @ApiStandardErrorResponses({
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
    @Param("ceremonyId") ceremonyId: string,
    @Body() request: CreateIssuingIssuerRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateIssuingIssuerResponse = {
      issuer: await this.ceremonies.createIssuing(
        principal,
        ceremonyId,
        request,
      ),
    };
    setLocation(response, httpRequest, DescribeIssuerController, {
      issuerId: responseBody.issuer.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
