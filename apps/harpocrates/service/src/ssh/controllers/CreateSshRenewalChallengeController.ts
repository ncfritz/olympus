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
  CreateSshRenewalChallengeRequest,
  CreateSshRenewalChallengeResponse,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshHostRenewalService } from "../services/SshHostRenewalService";

@SignedRenewal()
@Controller({ version: "1" })
export class CreateSshRenewalChallengeController {
  constructor(private readonly renewals: SshHostRenewalService) {}

  @Post("/ssh/host-renewals/challenges")
  @ApiOperation({
    summary: "Asks for a challenge to renew an SSH host certificate",
    description:
      "On the renewal listener (9443) only (ADR 0035): for a host certificate Harpocrates issued, current, not revoked and not already renewed, a nonce to sign with the host key (`ssh-keygen -Y sign -n harpocrates-ssh-renew`) within five minutes, and whether the certificate is due.",
    operationId: "CreateSshRenewalChallenge",
    tags: ["Renewal"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateSshRenewalChallengeRequest,
    required: true,
    description: "The host's current certificate.",
  })
  @ApiCreatedResponse({
    description: "The challenge.",
    type: CreateSshRenewalChallengeResponse,
  })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
    ],
  })
  async handle(
    @Body() request: CreateSshRenewalChallengeRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateSshRenewalChallengeResponse = {
      challenge: await this.renewals.challenge(request.certificate),
    };
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
