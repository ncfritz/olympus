import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { RenewalPublished } from "../../auth/clientCertificate";
import {
  SSH_CERTIFICATE_TYPE_VALUES,
  type SshCertificateTypeName,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshKrlService } from "../services/SshKrlService";

@RenewalPublished()
@Controller({ version: "1" })
export class DescribeSshTypeKrlController {
  constructor(private readonly krls: SshKrlService) {}

  @Get("/ssh/krl/:type")
  @ApiOperation({
    summary: "Gets every SSH CA of a type's KRL",
    description:
      "On the renewal listener (9443) only, to anyone (ADR 0035): the revocations of every user or host CA in one KRL, as published: it changes on a revocation and every CRL_REFRESH_HOURS. A KRL is not signed, so hosts fetch it here, over HTTPS from Harpocrates's own certificate, into the file RevokedKeys (or RevokedHostKeys) names.",
    operationId: "DescribeSshTypeKrl",
    tags: ["Renewal"],
  })
  @ApiProduces("application/octet-stream")
  @ApiParam({
    name: "type",
    description: "user or host",
    enum: [...SSH_CERTIFICATE_TYPE_VALUES],
  })
  @ApiOkResponse({
    description: "The KRL, OpenSSH's binary format.",
    schema: { type: "string", format: "binary" },
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Param("type") type: string,
    @Res() response: Response,
  ): Promise<void> {
    if (!SSH_CERTIFICATE_TYPE_VALUES.includes(type as SshCertificateTypeName)) {
      throw new BadRequestException("The type is user or host");
    }
    const krl = await this.krls.publishedTypeKrl(
      type as SshCertificateTypeName,
    );
    response
      .status(HttpStatus.OK)
      .type("application/octet-stream")
      .setHeader("Cache-Control", "no-cache")
      .send(krl);
  }
}
