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
  OpenCeremonyRequest,
  OpenCeremonyResponse,
} from "../../model/ceremonies";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { CeremonyService } from "../services/CeremonyService";
import { DescribeCeremonyController } from "./DescribeCeremonyController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class OpenCeremonyController {
  constructor(private readonly ceremonies: CeremonyService) {}

  @Post("/ceremonies")
  @ApiOperation({
    summary: "Opens a ceremony",
    description:
      "Puts an offline CA's key in the signer for one ceremony: an hour at most, and never across a restart or a seal. One ceremony at a time.",
    operationId: "OpenCeremony",
    tags: ["Ceremonies"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: OpenCeremonyRequest,
    required: true,
    description: "The offline CA and its key.",
  })
  @ApiCreatedResponse({
    description: "The ceremony is open.",
    type: OpenCeremonyResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The ceremony" },
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
    @Body() request: OpenCeremonyRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: OpenCeremonyResponse = {
      ceremony: await this.ceremonies.open(
        principal,
        request.issuerId,
        request.privateKey,
        request.passphrase,
      ),
    };
    setLocation(response, httpRequest, DescribeCeremonyController, {
      ceremonyId: responseBody.ceremony.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
