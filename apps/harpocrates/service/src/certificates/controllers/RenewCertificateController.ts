import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AnyPkiRole } from "../../auth/roles";
import {
  RenewCertificateRequest,
  RenewCertificateResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { CertificateService } from "../services/CertificateService";
import { DescribeCertificateController } from "./DescribeCertificateController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class RenewCertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Post("/certificate/:certificateId/renew")
  @ApiOperation({
    summary: "Renews a certificate",
    description:
      "Issues a certificate with the same subject, names and profile, from the profile's current issuer. The key is certified again while it is younger than the profile's maximum key age; a CSR for a new key rekeys, and a generated key past its age is replaced.",
    operationId: "RenewCertificate",
    tags: ["Certificates"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "certificateId",
    description: "The certificate to renew",
    type: String,
  })
  @ApiBody({
    type: RenewCertificateRequest,
    required: true,
    description: "A CSR, to rekey.",
  })
  @ApiCreatedResponse({
    description: "The renewal was issued.",
    type: RenewCertificateResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The renewal" },
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
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Body() request: RenewCertificateRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RenewCertificateResponse = {
      certificate: await this.certificates.renew(
        principal,
        certificateId,
        request,
      ),
    };
    setLocation(response, httpRequest, DescribeCertificateController, {
      certificateId: responseBody.certificate.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
