import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { DescribeCertificateResponse } from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateService } from "../services/CertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeCertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Get("/certificate/:certificateId")
  @ApiOperation({
    summary: "Describes a certificate",
    description:
      "A certificate with its PEM, chain, key history, renewals and revocation.",
    operationId: "DescribeCertificate",
    tags: ["Certificates"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "certificateId",
    description: "The certificate's ID",
    type: String,
  })
  @ApiOkResponse({
    description: "The certificate.",
    type: DescribeCertificateResponse,
  })
  @ApiStandardErrorResponses({ include: [HttpStatus.FORBIDDEN] })
  @AnyPkiRole()
  async handle(
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeCertificateResponse = {
      certificate: await this.certificates.describe(certificateId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
