import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { SignedRenewal } from "../../auth/clientCertificate";
import {
  CreateSshCertificateResponse,
  RenewSshHostCertificateRequest,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshHostRenewalService } from "../services/SshHostRenewalService";

@SignedRenewal()
@Controller({ version: "1" })
export class RenewSshHostCertificateController {
  constructor(private readonly renewals: SshHostRenewalService) {}

  @Post("/ssh/host-renewals")
  @ApiOperation({
    summary: "Renews an SSH host certificate",
    description:
      "On the renewal listener (9443) only (ADR 0035): the challenge, signed by the certificate's own host key, gets the next certificate for the same key and principals under the same profile version, once the certificate is due. A challenge is tried once.",
    operationId: "RenewSshHostCertificate",
    tags: ["Renewal"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: RenewSshHostCertificateRequest,
    required: true,
    description: "The challenge and its signature.",
  })
  @ApiCreatedResponse({
    description: "The renewal was issued.",
    type: CreateSshCertificateResponse,
  })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  async handle(
    @Body() request: RenewSshHostCertificateRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateSshCertificateResponse = {
      certificate: await this.renewals.renew(
        request.challengeId,
        request.signature,
      ),
    };
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
