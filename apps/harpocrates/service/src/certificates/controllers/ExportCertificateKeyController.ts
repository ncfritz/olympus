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
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import {
  ExportCertificateKeyRequest,
  ExportCertificateKeyResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateService } from "../services/CertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ExportCertificateKeyController {
  constructor(private readonly certificates: CertificateService) {}

  @Post("/certificate/:certificateId/key-export")
  @ApiOperation({
    summary: "Exports a certificate's escrowed key",
    description:
      "Exports the escrowed key of a certificate whose key the signer generated, encrypted under a passphrase, with a reason. pki-admin only, after a recent sign-in; every export is recorded.",
    operationId: "ExportCertificateKey",
    tags: ["Certificates"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "certificateId",
    description: "The certificate whose key to export",
    type: String,
  })
  @ApiBody({
    type: ExportCertificateKeyRequest,
    required: true,
    description: "The format, passphrase and reason.",
  })
  @ApiOkResponse({
    description: "The key, as a file.",
    type: ExportCertificateKeyResponse,
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
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Body() request: ExportCertificateKeyRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ExportCertificateKeyResponse =
      await this.certificates.exportKey(principal, certificateId, request);
    response.status(HttpStatus.OK).send(responseBody);
  }
}
