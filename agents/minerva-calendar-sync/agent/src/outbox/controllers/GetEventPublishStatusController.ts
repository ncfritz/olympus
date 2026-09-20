import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { GetEventPublishStatusResponse } from "../../model/outbox";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OutboxService } from "../services/OutboxService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetEventPublishStatusController {
  constructor(private readonly outbox: OutboxService) {}

  @Get("/event/:eventId/publish-status")
  @ApiOperation({
    summary: "Gets an event's publish status",
    description:
      "Returns whether publishing is enabled and the calendar event's latest outbox event.",
    operationId: "GetEventPublishStatus",
    tags: ["Outbox"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "eventId",
    description: "The ID of the calendar event (source:uid)",
    type: String,
  })
  @ApiOkResponse({
    description: "The publish status was found.",
    type: GetEventPublishStatusResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
  })
  async handle(
    @Param("eventId") eventId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetEventPublishStatusResponse = {
      eventPublishStatus: await this.outbox.getEventPublishStatus(eventId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
