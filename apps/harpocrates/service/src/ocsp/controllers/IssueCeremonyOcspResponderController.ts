import {
  Controller,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
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
import { IssueCeremonyOcspResponderResponse } from "../../model/ocsp";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { OcspResponderService } from "../services/OcspResponderService";
import { OcspResponseService } from "../services/OcspResponseService";
import { ListIssuerOcspRespondersController } from "./ListIssuerOcspRespondersController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class IssueCeremonyOcspResponderController {
  private readonly logger = new Logger(
    IssueCeremonyOcspResponderController.name,
  );

  constructor(
    private readonly responders: OcspResponderService,
    private readonly responses: OcspResponseService,
  ) {}

  @Post("/ceremony/:ceremonyId/ocsp-responder")
  @ApiOperation({
    summary: "Issues an offline CA's OCSP responder in a ceremony",
    description:
      "The ceremony's CA issues its OCSP responder (ADR 0036): a certificate for a new key in the signer, valid as long as its list (CRL_OFFLINE_VALIDITY_DAYS), which signs the CA's responses while its own key is offline. It supersedes the CA's earlier responder; its responses are signed at once.",
    operationId: "IssueCeremonyOcspResponder",
    tags: ["Ceremonies"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "ceremonyId",
    description: "The open ceremony",
    type: String,
  })
  @ApiCreatedResponse({
    description: "The responder was issued.",
    type: IssueCeremonyOcspResponderResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The CA's responders",
      },
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
    const responseBody: IssueCeremonyOcspResponderResponse = {
      responder: await this.responders.issueInCeremony(principal, ceremonyId),
    };
    const { issuerId } = responseBody.responder;
    // Its responses now; the scheduler signs whatever this misses.
    await this.responses.refresh(issuerId).catch((error: unknown) => {
      this.logger.warn(
        `${issuerId}'s responses wait for the next run: ${String(error)}`,
      );
    });
    setLocation(response, httpRequest, ListIssuerOcspRespondersController, {
      issuerId,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
