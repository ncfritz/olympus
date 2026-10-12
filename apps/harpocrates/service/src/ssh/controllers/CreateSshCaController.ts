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
import { CreateSshCaRequest, CreateSshCaResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { SshCaService } from "../services/SshCaService";
import { DescribeSshCaController } from "./DescribeSshCaController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateSshCaController {
  constructor(private readonly cas: SshCaService) {}

  @Post("/ssh/cas")
  @ApiOperation({
    summary: "Creates an SSH CA",
    description:
      "An online Ed25519 key in the signer that signs one type of SSH certificate (ADR 0035), with no ceremony. For a type and number that has one, it is the next generation: a rotation, trusted beside the old until the old is retired and its certificates expire.",
    operationId: "CreateSshCa",
    tags: ["SSH"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateSshCaRequest,
    required: true,
    description:
      "Its type, and its number and longest certificate if not the defaults.",
  })
  @ApiCreatedResponse({
    description: "The CA was created.",
    type: CreateSshCaResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The CA" },
    },
  })
  @ApiStandardErrorResponses({
    include: [HttpStatus.FORBIDDEN, HttpStatus.CONFLICT],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Body() request: CreateSshCaRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateSshCaResponse = {
      ca: await this.cas.create(principal, request),
    };
    setLocation(response, httpRequest, DescribeSshCaController, {
      caId: responseBody.ca.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
