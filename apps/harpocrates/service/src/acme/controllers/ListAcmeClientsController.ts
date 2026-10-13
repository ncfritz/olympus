import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import moment from "moment";
import { AnyPkiRole } from "../../auth/roles";
import { ListAcmeClientsResponse } from "../../model/acme";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AcmeOverviewService } from "../services/AcmeOverviewService";
import { AcmeUrls } from "../services/AcmeUrls";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListAcmeClientsController {
  constructor(
    private readonly overview: AcmeOverviewService,
    private readonly urls: AcmeUrls,
  ) {}

  @Get("/acme/clients")
  @ApiOperation({
    summary: "Lists ACME clients",
    description:
      "Every ACME client, newest credential first: its credential and the account bound with it, the certificates it holds now with the renewal window its client is told (RFC 9773), and its last order, step by step. Never their keys.",
    operationId: "ListAcmeClients",
    tags: ["ACME Credentials"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The clients.",
    type: ListAcmeClientsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const now = new Date();
    const responseBody: ListAcmeClientsResponse = {
      asOf: moment(now),
      directoryUrl: this.urls.directory(),
      clients: await this.overview.clients(now),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
