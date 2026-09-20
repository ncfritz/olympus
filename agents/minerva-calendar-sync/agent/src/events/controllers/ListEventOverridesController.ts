import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  ListEventOverridesQuery,
  ListEventOverridesResponse,
} from "../../model/events";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { EventOverrideService } from "../services/EventOverrideService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListEventOverridesController {
  constructor(private readonly eventOverrides: EventOverrideService) {}

  @Get("/event-overrides")
  @ApiOperation({
    summary: "Lists event overrides",
    description:
      "Returns the availability overrides of the given events, for a whole page of events in one request.",
    operationId: "ListEventOverrides",
    tags: ["Event Overrides"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The overrides were listed.",
    type: ListEventOverridesResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: ListEventOverridesQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListEventOverridesResponse = {
      eventOverrides: await this.eventOverrides.list(query.ids),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
