import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { ListIssuersResponse } from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerService } from "../services/IssuerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListIssuersController {
  constructor(private readonly issuers: IssuerService) {}

  @Get("/issuers")
  @ApiOperation({
    summary: "Lists the certificate authorities",
    description:
      "Every CA, roots first, with its status, validity, issuing window and rules; the tree follows parentId.",
    operationId: "ListIssuers",
    tags: ["Issuers"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({ description: "The CAs.", type: ListIssuersResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListIssuersResponse = {
      issuers: await this.issuers.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
