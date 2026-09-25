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
import { AnyPkiRole } from "../../auth/roles";
import {
  CreateCertificateRequest,
  CreateCertificateResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { CertificateService } from "../services/CertificateService";
import { DescribeCertificateController } from "./DescribeCertificateController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateCertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Post("/certificates")
  @ApiOperation({
    summary: "Issues a certificate",
    description:
      "Issues a certificate under a profile, from the subscriber's CSR or with a key the signer generates and escrows. The profile's rules, the key's history and the signer's invariants all apply; a refusal is a 422 and is recorded in the audit log.",
    operationId: "CreateCertificate",
    tags: ["Certificates"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCertificateRequest,
    required: true,
    description: "The profile, subject, names and CSR.",
  })
  @ApiCreatedResponse({
    description: "The certificate was issued.",
    type: CreateCertificateResponse,
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
  @AnyPkiRole()
  async handle(
    @Body() request: CreateCertificateRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateCertificateResponse = {
      certificate: await this.certificates.create(principal, request),
    };
    setLocation(response, httpRequest, DescribeCertificateController, {
      certificateId: responseBody.certificate.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
