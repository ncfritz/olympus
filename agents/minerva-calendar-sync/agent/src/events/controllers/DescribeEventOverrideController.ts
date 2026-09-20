import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { DescribeEventOverrideResponse } from "../../model/events";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { EventOverrideService } from "../services/EventOverrideService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeEventOverrideController {
  constructor(private readonly eventOverrides: EventOverrideService) {}

  @Get("/event/:eventId/override")
  @ApiOperation({
    summary: "Describes an event override",
    description: "Returns the availability override set on an event.",
    operationId: "DescribeEventOverride",
    tags: ["Event Overrides"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "eventId",
    description: "The ID of the event (source:uid)",
    type: String,
  })
  @ApiOkResponse({
    description: "The override was found.",
    type: DescribeEventOverrideResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("eventId") eventId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeEventOverrideResponse = {
      eventOverride: await this.eventOverrides.describe(eventId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
