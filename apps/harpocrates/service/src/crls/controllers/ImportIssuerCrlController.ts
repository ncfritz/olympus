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
import { AdminOnly } from "../../auth/roles";
import {
  ImportIssuerCrlRequest,
  ImportIssuerCrlResponse,
} from "../../model/crls";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { CrlScheduler } from "../services/CrlScheduler";
import { CrlService } from "../services/CrlService";
import { ListIssuerCrlsController } from "./ListIssuerCrlsController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ImportIssuerCrlController {
  constructor(
    private readonly crls: CrlService,
    private readonly scheduler: CrlScheduler,
  ) {}

  @Post("/issuer/:issuerId/crls")
  @ApiOperation({
    summary: "Imports a CA's revocation list",
    description:
      "Offers a list signed elsewhere (XCA's last, or an offline CA's) for publication. Refused unless the CA's certificate verifies it, it has not lapsed, and its number is above every one the CA has. Its serials are carried into the CA's later lists, and an online CA signs a fresh list straight after.",
    operationId: "ImportIssuerCrl",
    tags: ["Revocation Lists"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiBody({
    type: ImportIssuerCrlRequest,
    required: true,
    description: "The list, PEM.",
  })
  @ApiCreatedResponse({
    description: "The list was imported.",
    type: ImportIssuerCrlResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The CA's lists" },
    },
  })
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
    @Body() request: ImportIssuerCrlRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ImportIssuerCrlResponse = {
      crl: await this.crls.import(principal, issuerId, request.crl),
    };
    void this.scheduler.kick();
    setLocation(response, httpRequest, ListIssuerCrlsController, { issuerId });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
