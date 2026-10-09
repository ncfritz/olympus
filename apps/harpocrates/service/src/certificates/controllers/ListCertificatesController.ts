import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import {
  ListCertificatesQuery,
  ListCertificatesResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateService } from "../services/CertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListCertificatesController {
  constructor(private readonly certificates: CertificateService) {}

  @Get("/certificates")
  @ApiOperation({
    summary: "Lists certificates",
    description:
      "Certificates, soonest to expire first, by issuer, profile, state, text or how soon they expire.",
    operationId: "ListCertificates",
    tags: ["Certificates"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The certificates.",
    type: ListCertificatesResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Query() query: ListCertificatesQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListCertificatesResponse =
      await this.certificates.list(query);
    response.status(HttpStatus.OK).send(responseBody);
  }
}
