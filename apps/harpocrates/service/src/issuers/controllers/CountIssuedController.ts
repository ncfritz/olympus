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
import { CountIssuedResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerService } from "../services/IssuerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CountIssuedController {
  constructor(private readonly issuers: IssuerService) {}

  @Get("/issuer/:issuerId/issued")
  @ApiOperation({
    summary: "Counts what is beneath a certificate authority",
    description:
      "The CAs beneath it, at any depth, by tier and purpose, and the leaves it and they signed that are in use, by profile.",
    operationId: "CountIssued",
    tags: ["Issuers"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "issuerId", description: "The CA's slug", type: String })
  @ApiOkResponse({ description: "The counts.", type: CountIssuedResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("issuerId") issuerId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CountIssuedResponse = {
      counts: await this.issuers.countIssued(issuerId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
