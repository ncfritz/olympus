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
import { DescribeIssuerResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerService } from "../services/IssuerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeIssuerController {
  constructor(private readonly issuers: IssuerService) {}

  @Get("/issuer/:issuerId")
  @ApiOperation({
    summary: "Describes a certificate authority",
    description:
      "A CA with its certificate and the chain above it, nearest first.",
    operationId: "DescribeIssuer",
    tags: ["Issuers"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiOkResponse({ description: "The CA.", type: DescribeIssuerResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("issuerId") issuerId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeIssuerResponse = {
      issuer: await this.issuers.describe(issuerId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
