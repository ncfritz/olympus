import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { DescribeSshCertificateResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshCertificateService } from "../services/SshCertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeSshCertificateController {
  constructor(private readonly certificates: SshCertificateService) {}

  @Get("/ssh/certificate/:certificateId")
  @ApiOperation({
    summary: "Describes an SSH certificate",
    description: "Its principals, validity, state and the certificate itself.",
    operationId: "DescribeSshCertificate",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "certificateId",
    description: "The certificate's id",
    type: String,
  })
  @ApiOkResponse({
    description: "The certificate.",
    type: DescribeSshCertificateResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("certificateId") certificateId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeSshCertificateResponse = {
      certificate: await this.certificates.describe(certificateId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
