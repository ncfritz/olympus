import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly } from "../../auth/roles";
import {
  CreateAcmeCredentialRequest,
  CreateAcmeCredentialResponse,
} from "../../model/acme";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AcmeCredentialService } from "../services/AcmeCredentialService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateAcmeCredentialController {
  constructor(private readonly credentials: AcmeCredentialService) {}

  @Post("/acme/credentials")
  @ApiOperation({
    summary: "Creates an ACME credential",
    description:
      "Makes an External Account Binding credential for one ACME client: its key id and HMAC key, which the answer shows once, and the names or subtrees its account may request from the TLS CA. A credential registers one account; binding erases its key.",
    operationId: "CreateAcmeCredential",
    tags: ["ACME Credentials"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateAcmeCredentialRequest,
    required: true,
    description: "What it is for, and its names.",
  })
  @ApiCreatedResponse({
    description: "The credential, with its HMAC key this once.",
    type: CreateAcmeCredentialResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  async handle(
    @Body() request: CreateAcmeCredentialRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateAcmeCredentialResponse =
      await this.credentials.create(principal, request);
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
