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
  ListSshCertificatesQuery,
  ListSshCertificatesResponse,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshCertificateService } from "../services/SshCertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListSshCertificatesController {
  constructor(private readonly certificates: SshCertificateService) {}

  @Get("/ssh/certificates")
  @ApiOperation({
    summary: "Lists SSH certificates",
    description:
      "SSH certificates, newest first: by type, and only the current ones (who holds a valid user certificate now) if asked.",
    operationId: "ListSshCertificates",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The certificates.",
    type: ListSshCertificatesResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Query() query: ListSshCertificatesQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListSshCertificatesResponse = {
      certificates: await this.certificates.list(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
