import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { DescribeEventResponse } from "../../model/events";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { EventService } from "../services/EventService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeEventController {
  constructor(private readonly events: EventService) {}

  @Get("/event/:eventId")
  @ApiOperation({
    summary: "Describes an event",
    description: "Returns a single synced event.",
    operationId: "DescribeEvent",
    tags: ["Events"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "eventId",
    description: "The ID of the event (source:uid)",
    type: String,
  })
  @ApiOkResponse({
    description: "The event was found.",
    type: DescribeEventResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("eventId") eventId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeEventResponse = {
      event: await this.events.describe(eventId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
