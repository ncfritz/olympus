import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import moment from "moment";
import { AnyPkiRole } from "../../auth/roles";
import { ListAcmeOrdersQuery, ListAcmeOrdersResponse } from "../../model/acme";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AcmeOverviewService } from "../services/AcmeOverviewService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListAcmeOrdersController {
  constructor(private readonly overview: AcmeOverviewService) {}

  @Get("/acme/orders")
  @ApiOperation({
    summary: "Lists ACME orders",
    description:
      "Every ACME order of the last days (30 by default, at most 90), newest first: its client's credential, its names, the challenges answered for each and how they ended, why it failed, and when its certificate was issued.",
    operationId: "ListAcmeOrders",
    tags: ["ACME Credentials"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The orders.",
    type: ListAcmeOrdersResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Query() query: ListAcmeOrdersQuery,
    @Res() response: Response,
  ): Promise<void> {
    const now = new Date();
    const { since, orders } = await this.overview.orders(query.days ?? 30, now);
    const responseBody: ListAcmeOrdersResponse = {
      asOf: moment(now),
      since: moment(since),
      orders,
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
