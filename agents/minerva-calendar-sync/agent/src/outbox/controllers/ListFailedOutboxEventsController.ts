import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  ListFailedOutboxEventsQuery,
  ListFailedOutboxEventsResponse,
} from "../../model/outbox";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OutboxService } from "../services/OutboxService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListFailedOutboxEventsController {
  constructor(private readonly outbox: OutboxService) {}

  @Get("/outbox-events/failed")
  @ApiOperation({
    summary: "Lists failed outbox events",
    description:
      "Returns the event changes that gave up being published, newest first.",
    operationId: "ListFailedOutboxEvents",
    tags: ["Outbox"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The failed outbox events were listed.",
    type: ListFailedOutboxEventsResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: ListFailedOutboxEventsQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListFailedOutboxEventsResponse = {
      outboxEvents: await this.outbox.listFailed(query.limit),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
