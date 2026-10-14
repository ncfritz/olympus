import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly } from "../../auth/roles";
import {
  AddCertificateKeyRequest,
  AddCertificateKeyResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateImportService } from "../services/CertificateImportService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class AddCertificateKeyController {
  constructor(private readonly imports: CertificateImportService) {}

  @Post("/certificate/:certificateId/key")
  @ApiOperation({
    summary: "Gives an imported certificate its key",
    description:
      "Escrows the private key of a certificate imported from another CA product (XCA) as a record, and keeps the CSR it was issued from if one is given (ADR 0039). The key must be the certificate's, and the CSR signed by it; a profile that takes CSRs only keeps its keys with the subscriber.",
    operationId: "AddCertificateKey",
    tags: ["Certificates"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "certificateId",
    description: "The imported certificate",
    type: String,
  })
  @ApiBody({
    type: AddCertificateKeyRequest,
    required: true,
    description: "The key, its passphrase, and optionally the CSR.",
  })
  @ApiOkResponse({
    description: "The certificate.",
    type: AddCertificateKeyResponse,
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
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Body() request: AddCertificateKeyRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: AddCertificateKeyResponse = {
      certificate: await this.imports.addKey(principal, certificateId, request),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
