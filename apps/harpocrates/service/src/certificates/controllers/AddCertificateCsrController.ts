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
  AddCertificateCsrRequest,
  AddCertificateCsrResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateImportService } from "../services/CertificateImportService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class AddCertificateCsrController {
  constructor(private readonly imports: CertificateImportService) {}

  @Post("/certificate/:certificateId/csr")
  @ApiOperation({
    summary: "Gives an imported certificate its CSR",
    description:
      "Keeps the CSR an imported certificate was issued from, once its key is escrowed and while it has none (ADR 0039). The CSR must be signed by that key.",
    operationId: "AddCertificateCsr",
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
    type: AddCertificateCsrRequest,
    required: true,
    description: "The CSR, PEM.",
  })
  @ApiOkResponse({
    description: "The certificate.",
    type: AddCertificateCsrResponse,
  })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
    ],
  })
  @AdminOnly()
  async handle(
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Body() request: AddCertificateCsrRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: AddCertificateCsrResponse = {
      certificate: await this.imports.addCsr(principal, certificateId, request),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
