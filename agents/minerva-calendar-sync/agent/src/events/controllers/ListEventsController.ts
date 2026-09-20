import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ListEventsQuery, ListEventsResponse } from "../../model/events";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { EventService } from "../services/EventService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListEventsController {
  constructor(private readonly events: EventService) {}

  @Get("/events")
  @ApiOperation({
    summary: "Lists events",
    description:
      "Returns synced events, newest first, filtered and paged by the query.",
    operationId: "ListEvents",
    tags: ["Events"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The events were listed.",
    type: ListEventsResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: ListEventsQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListEventsResponse = {
      events: await this.events.list(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
