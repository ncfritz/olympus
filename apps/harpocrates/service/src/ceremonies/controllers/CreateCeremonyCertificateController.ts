import {
  Body,
  Controller,
  HttpStatus,
  Param,
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
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import { DescribeCertificateController } from "../../certificates/controllers/DescribeCertificateController";
import { CertificateService } from "../../certificates/services/CertificateService";
import {
  CreateCeremonyCertificateRequest,
  CreateCeremonyCertificateResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateCeremonyCertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Post("/ceremony/:ceremonyId/certificates")
  @ApiOperation({
    summary: "Issues a certificate in a ceremony",
    description:
      "Issues a leaf signed directly by the ceremony's root, for a root that signs directly (ADR 0032): the key is generated in the signer and escrowed unless the profile lets the request choose otherwise. Only direct-only profiles; a refusal is a 422 and is recorded in the audit log.",
    operationId: "CreateCeremonyCertificate",
    tags: ["Ceremonies"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "ceremonyId",
    description: "The open ceremony",
    type: String,
  })
  @ApiBody({
    type: CreateCeremonyCertificateRequest,
    required: true,
    description: "The profile, subject, validity and escrow.",
  })
  @ApiCreatedResponse({
    description: "The certificate was issued.",
    type: CreateCeremonyCertificateResponse,
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
  @RecentSignIn()
  async handle(
    @Param("ceremonyId") ceremonyId: string,
    @Body() request: CreateCeremonyCertificateRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateCeremonyCertificateResponse = {
      certificate: await this.certificates.createInCeremony(
        principal,
        ceremonyId,
        request,
      ),
    };
    setLocation(response, httpRequest, DescribeCertificateController, {
      certificateId: responseBody.certificate.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
