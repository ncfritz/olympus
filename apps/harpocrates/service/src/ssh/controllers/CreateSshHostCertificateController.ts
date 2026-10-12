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
import { AdminOnly } from "../../auth/roles";
import {
  CreateSshCertificateResponse,
  CreateSshHostCertificateRequest,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { SshCertificateService } from "../services/SshCertificateService";
import { DescribeSshCertificateController } from "./DescribeSshCertificateController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateSshHostCertificateController {
  constructor(private readonly certificates: SshCertificateService) {}

  @Post("/ssh/certificates/host")
  @ApiOperation({
    summary: "Issues an SSH host certificate",
    description:
      "A host certificate for a host's key and names (ADR 0035): clients trusting the host CA connect without a host-key prompt. From then on the host renews it itself, by proving its key.",
    operationId: "CreateSshHostCertificate",
    tags: ["SSH"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateSshHostCertificateRequest,
    required: true,
    description: "The host's key and names.",
  })
  @ApiCreatedResponse({
    description: "The certificate was issued.",
    type: CreateSshCertificateResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The certificate" },
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
  async handle(
    @Body() request: CreateSshHostCertificateRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateSshCertificateResponse = {
      certificate: await this.certificates.issueHost(principal, request),
    };
    setLocation(response, httpRequest, DescribeSshCertificateController, {
      certificateId: responseBody.certificate.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
