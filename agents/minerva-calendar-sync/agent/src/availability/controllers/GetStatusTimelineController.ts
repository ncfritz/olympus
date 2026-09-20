import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  GetStatusTimelineQuery,
  GetStatusTimelineResponse,
} from "../../model/availability";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AvailabilityService } from "../services/AvailabilityService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetStatusTimelineController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("/availability/timeline")
  @ApiOperation({
    summary: "Gets the status timeline",
    description:
      "Returns the status of each 15-minute chunk of the range, with working hours, weekends and the time zone applied, as the console's timeline shows it.",
    operationId: "GetStatusTimeline",
    tags: ["Availability"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The timeline was computed.",
    type: GetStatusTimelineResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: GetStatusTimelineQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetStatusTimelineResponse = {
      timeline: await this.availability.getStatusTimeline(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
