import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly } from "../../auth/roles";
import {
  ImportCertificatesRequest,
  ImportCertificatesResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateImportService } from "../services/CertificateImportService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ImportCertificatesController {
  constructor(private readonly imports: CertificateImportService) {}

  @Post("/certificates/import")
  @ApiOperation({
    summary: "Imports certificates another CA product issued",
    description:
      "Records certificates XCA issued, each under the CA here that signed it, with its serial, dates and key, as issued under the named profile. Already imported ones, CAs, CA keys and certificates no CA here signed are passed over and listed. Import the CAs first, and their last revocation lists after, which revoke what they name.",
    operationId: "ImportCertificates",
    tags: ["Certificates"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ImportCertificatesRequest,
    required: true,
    description: "The profile, and the certificates as PEM.",
  })
  @ApiOkResponse({
    description: "What was imported and what was passed over.",
    type: ImportCertificatesResponse,
  })
  @ApiStandardErrorResponses({ include: [HttpStatus.FORBIDDEN] })
  @AdminOnly()
  async handle(
    @Body() request: ImportCertificatesRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ImportCertificatesResponse = await this.imports.import(
      principal,
      request,
    );
    response.status(HttpStatus.OK).send(responseBody);
  }
}
