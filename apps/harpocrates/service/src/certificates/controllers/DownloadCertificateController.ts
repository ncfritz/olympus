import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
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
import { DownloadCertificateQuery } from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateService } from "../services/CertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DownloadCertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Get("/certificate/:certificateId/download")
  @ApiOperation({
    summary: "Downloads a certificate",
    description:
      "The certificate as a file: PEM, DER, or PEM followed by the CAs above it, without the root, as a server presents it.",
    operationId: "DownloadCertificate",
    tags: ["Certificates"],
  })
  @ApiProduces("application/x-pem-file", "application/pkix-cert")
  @ApiParam({
    name: "certificateId",
    description: "The certificate's ID",
    type: String,
  })
  @ApiOkResponse({
    description: "The file.",
    schema: { type: "string", format: "binary" },
  })
  @ApiStandardErrorResponses({ include: [HttpStatus.FORBIDDEN] })
  @AnyPkiRole()
  async handle(
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Query() query: DownloadCertificateQuery,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.certificates.download(
      certificateId,
      query.format ?? "pem",
    );
    response.setHeader("Content-Type", file.contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName}"`,
    );
    response.status(HttpStatus.OK).send(file.body);
  }
}
