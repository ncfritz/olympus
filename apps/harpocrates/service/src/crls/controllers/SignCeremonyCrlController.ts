import { Controller, HttpStatus, Param, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import { SignCeremonyCrlResponse } from "../../model/crls";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { CrlScheduler } from "../services/CrlScheduler";
import { CrlService } from "../services/CrlService";
import { ListIssuerCrlsController } from "./ListIssuerCrlsController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class SignCeremonyCrlController {
  constructor(
    private readonly crls: CrlService,
    private readonly scheduler: CrlScheduler,
  ) {}

  @Post("/ceremony/:ceremonyId/crl")
  @ApiOperation({
    summary: "Signs an offline CA's revocation list in a ceremony",
    description:
      "The ceremony's CA signs its next list, valid for 13 months (CRL_OFFLINE_VALIDITY_DAYS), which is then published with the rest. Due once a year and whenever a CA below it is revoked.",
    operationId: "SignCeremonyCrl",
    tags: ["Ceremonies"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "ceremonyId",
    description: "The open ceremony",
    type: String,
  })
  @ApiCreatedResponse({
    description: "The list was signed.",
    type: SignCeremonyCrlResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The CA's lists" },
    },
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
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
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SignCeremonyCrlResponse = {
      crl: await this.crls.signInCeremony(principal, ceremonyId),
    };
    void this.scheduler.kick();
    setLocation(response, httpRequest, ListIssuerCrlsController, {
      issuerId: responseBody.crl.issuerId,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
