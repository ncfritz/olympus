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
import { CreateIntermediateIssuerResponse } from "../../model/ceremonies";
import { CreateIntermediateIssuerRequest } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { CeremonyService } from "../services/CeremonyService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateIntermediateIssuerController {
  constructor(private readonly ceremonies: CeremonyService) {}

  @Post("/ceremony/:ceremonyId/intermediates")
  @ApiOperation({
    summary: "Creates an intermediate in a ceremony",
    description:
      "Creates an offline intermediate below the ceremony's root, when the root has three tiers: the signer generates its key, the root signs it, and the key is returned encrypted, once. Settings left out take their defaults; a validity past the root's is refused.",
    operationId: "CreateIntermediateIssuer",
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
    type: CreateIntermediateIssuerRequest,
    required: true,
    description:
      "The intermediate's number, generation, constraints and export passphrase.",
  })
  @ApiCreatedResponse({
    description: "The intermediate was created.",
    type: CreateIntermediateIssuerResponse,
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
    @Body() request: CreateIntermediateIssuerRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateIntermediateIssuerResponse =
      await this.ceremonies.createIntermediate(principal, ceremonyId, request);
    setLocation(response, httpRequest, DescribeIssuerController, {
      issuerId: responseBody.issuer.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
