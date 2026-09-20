import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { GetOutboxSummaryResponse } from "../../model/outbox";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OutboxService } from "../services/OutboxService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetOutboxSummaryController {
  constructor(private readonly outbox: OutboxService) {}

  @Get("/outbox/summary")
  @ApiOperation({
    summary: "Gets the outbox summary",
    description:
      "Returns whether publishing is enabled and each source's waiting, published and failed event counts.",
    operationId: "GetOutboxSummary",
    tags: ["Outbox"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The summary was computed.",
    type: GetOutboxSummaryResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
  })
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetOutboxSummaryResponse = {
      outboxSummary: await this.outbox.getSummary(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
